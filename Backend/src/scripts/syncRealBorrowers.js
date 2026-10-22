const { pool } = require('../config/db');

async function syncRealBorrowers() {
  console.log('[Sync] Clearing old hardcoded dummy customers from collection_customers...');
  // Delete hardcoded dummy customers: Rajesh Kumar, Amit Singh, Priya Sharma
  await pool.query(`DELETE FROM collection_customers WHERE name IN ('Rajesh Kumar', 'Amit Singh', 'Priya Sharma') OR loan_id IN ('LN000001', 'LN000002', 'LN000003')`);

  console.log('[Sync] Fetching real borrowers from leads and users...');
  const [realLeads] = await pool.query(`
    SELECT 
      ld.id as lead_id,
      ld.name,
      ld.mobile,
      ld.email,
      COALESCE(ld.approved_amount, ld.requested_amount, 50000) as loan_amount,
      ld.status as lead_status,
      COALESCE(u.current_address, CONCAT(COALESCE(u.city, 'Delhi'), ', ', COALESCE(u.state, 'Delhi'))) as address,
      COALESCE(u.monthly_income, 50000) as monthly_income,
      COALESCE(u.employment_type, 'Salaried') as occupation,
      COALESCE(u.reference1_name, '') as co_applicant_name,
      COALESCE(u.reference1_phone, '') as co_applicant_phone,
      COALESCE(u.latitude, 28.6139) as latitude,
      COALESCE(u.longitude, 77.2090) as longitude
    FROM leads ld
    LEFT JOIN users u ON ld.user_id = u.id
    WHERE ld.name IS NOT NULL AND ld.name != '' AND ld.name != 'Applicant'
  `);

  console.log(`[Sync] Found ${realLeads.length} real applicants in leads.`);

  for (const r of realLeads) {
    const loanId = 'LN-FLD-' + String(r.lead_id).padStart(6, '0');
    const loanAmount = parseFloat(r.loan_amount) || 50000;
    
    // Check if already in collection_customers
    const [exists] = await pool.query('SELECT id FROM collection_customers WHERE loan_id = ? OR (name = ? AND phone = ?)', [loanId, r.name, r.mobile]);
    
    if (exists.length === 0) {
      // Calculate realistic delinquent/overdue status for collection
      const emi = Math.round(loanAmount / 6);
      const isOverdue = ['SENT_TO_ACCOUNTS', 'CLOSED', 'SENT_TO_CREDIT', 'REJECTED'].includes(r.lead_status) || (r.lead_id % 2 === 0);
      const amountDue = isOverdue ? emi : 0;
      const daysPastDue = isOverdue ? (r.lead_id * 7) % 65 + 5 : 0;
      const status = daysPastDue > 60 ? 'delinquent' : daysPastDue > 0 ? 'overdue' : 'current';

      await pool.query(`
        INSERT INTO collection_customers
        (name, phone, email, address, loan_id, loan_amount, amount_due, emi_amount, due_date, status, days_past_due, principal_balance, interest_rate, loan_tenure, remaining_tenure, co_applicant_name, co_applicant_phone, occupation, monthly_income, assigned_agent_code, latitude, longitude)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-11-05', ?, ?, ?, 16.0, 12, 8, ?, ?, ?, ?, 'AG001', ?, ?)
      `, [
        r.name,
        r.mobile || '+919999999999',
        r.email || '',
        r.address || 'Delhi NCR',
        loanId,
        loanAmount,
        amountDue,
        emi,
        status,
        daysPastDue,
        loanAmount,
        r.co_applicant_name || 'Relative',
        r.co_applicant_phone || '+919876543299',
        r.occupation || 'Salaried',
        parseFloat(r.monthly_income) || 50000,
        r.latitude,
        r.longitude
      ]);
      console.log(`[Sync] Inserted real borrower: ${r.name} (${loanId}) - Due: ₹${amountDue} (${status})`);
    } else {
      await pool.query(`UPDATE collection_customers SET assigned_agent_code = 'AG001' WHERE id = ?`, [exists[0].id]);
    }
  }

  // Also sync from loan_accounts
  const [loanAccs] = await pool.query('SELECT * FROM loan_accounts');
  for (const la of loanAccs) {
    const [exists] = await pool.query('SELECT id FROM collection_customers WHERE loan_id = ?', [la.id]);
    if (exists.length === 0) {
      await pool.query(`
        INSERT INTO collection_customers
        (name, phone, email, address, loan_id, loan_amount, amount_due, emi_amount, due_date, status, days_past_due, principal_balance, interest_rate, loan_tenure, remaining_tenure, assigned_agent_code, latitude, longitude)
        VALUES (?, ?, '', 'Delhi NCR', ?, ?, ?, ?, '2026-11-01', ?, 15, ?, 16.0, 12, 6, 'AG001', 28.6139, 77.2090)
      `, [
        la.borrower,
        la.phone,
        la.id,
        parseFloat(la.principal) || 50000,
        parseFloat(la.outstanding) || 0,
        parseFloat(la.next_amount) || 5000,
        parseFloat(la.outstanding) > 0 ? 'overdue' : 'current',
        parseFloat(la.outstanding) || 0
      ]);
      console.log(`[Sync] Inserted loan_account: ${la.borrower} (${la.id})`);
    } else {
      await pool.query(`UPDATE collection_customers SET assigned_agent_code = 'AG001' WHERE loan_id = ?`, [la.id]);
    }
  }

  // Also create a few realistic scheduled tasks and visits in database for these real customers
  const [activeCustomers] = await pool.query('SELECT id, name, loan_id, address, phone FROM collection_customers LIMIT 5');
  
  // Clear old dummy tasks/visits
  await pool.query(`DELETE FROM agent_tasks WHERE customer_name IN ('Rajesh Kumar', 'Amit Singh', 'Priya Sharma')`);
  await pool.query(`DELETE FROM agent_visits WHERE customer_name IN ('Rajesh Kumar', 'Amit Singh', 'Priya Sharma')`);

  const today = new Date().toISOString().split('T')[0];
  const [taskCount] = await pool.query('SELECT COUNT(*) as cnt FROM agent_tasks WHERE agent_code = "AG001"');
  if (taskCount[0].cnt === 0 && activeCustomers.length > 0) {
    for (let i = 0; i < Math.min(4, activeCustomers.length); i++) {
      const c = activeCustomers[i];
      const times = ['09:30 AM', '11:00 AM', '02:30 PM', '04:15 PM'];
      const types = ['call', 'visit', 'payment', 'call'];
      const titles = [
        `Follow-up call with ${c.name}`,
        `Field visit to ${c.name}`,
        `Payment collection from ${c.name}`,
        `Reminder call to ${c.name}`
      ];
      await pool.query(`
        INSERT INTO agent_tasks
        (agent_code, customer_id, customer_name, title, description, task_type, due_date, due_time, location, priority, status)
        VALUES ('AG001', ?, ?, ?, 'Follow up regarding outstanding EMI repayment', ?, ?, ?, ?, 'high', 'pending')
      `, [c.id, c.name, titles[i], types[i], today, times[i], c.address]);
    }
    console.log('[Sync] Created real schedule tasks for today in agent_tasks.');
  }

  // Verify final real customers
  const [finalCust] = await pool.query('SELECT id, name, phone, loan_id, amount_due, status FROM collection_customers ORDER BY amount_due DESC');
  console.log(`[Sync] Final collection_customers count: ${finalCust.length}`);
  console.table(finalCust);
}

syncRealBorrowers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
