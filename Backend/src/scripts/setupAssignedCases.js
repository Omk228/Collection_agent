const { pool } = require('../config/db');

async function setupAssignments() {
  console.log('--- SETTING UP ASSIGNED CASES FOR COLLECTION AGENT (ID: 388, Code: AG001) ---');

  // 1. Assign real cases in `loan_accounts` to Collection Agent
  await pool.query(`
    UPDATE loan_accounts 
    SET assigned_agent = 'Collection Agent'
    WHERE id = 'LN-LEAD-302457'
  `);
  console.log('Assigned loan LN-LEAD-302457 (PUNEET ROHILLA) to Collection Agent');

  // 2. Assign real collection leads in `leads` table to Collection Agent (ID: 388)
  // Let's assign leads with status like CLOSED, SENT_TO_ACCOUNTS, etc. or specific leads to 388:
  // e.g. Lead 12 (PUNEET ROHILLA), Lead 6 (ANMOL VERMA), Lead 5 (SUBHRANIL BANERJEE), Lead 10 (CHANDRA KISHOR), Lead 31 (ATUL SHARMA)
  await pool.query(`
    UPDATE leads 
    SET assigned_to = 388 
    WHERE id IN (5, 6, 12, 31)
  `);
  console.log('Assigned leads 5, 6, 12, 31 to panel_user 388 (Collection Agent)');

  // 3. Clear fake test records from agent_payments and agent_visits so stats are 100% REAL
  await pool.query('DELETE FROM agent_payments WHERE transaction_reference LIKE "RCP-%"');
  await pool.query('DELETE FROM agent_visits WHERE visit_code LIKE "VST-%"');
  await pool.query('DELETE FROM agent_tasks WHERE id IN (7, 8) OR description LIKE "%PTP Follow-up%"');
  console.log('Cleared fake test payments, visits, and auto-generated tasks');

  // 4. Update collection_customers table so it contains STRICTLY the cases assigned to AG001 / 388:
  // First delete all unassigned records from collection_customers
  await pool.query('DELETE FROM collection_customers');

  // Now sync ONLY the cases assigned to 388 / AG001 from leads and loan_accounts
  const [assignedLeads] = await pool.query(`
    SELECT 
      ld.id as lead_id,
      ld.name,
      ld.mobile,
      ld.email,
      COALESCE(ld.approved_amount, ld.requested_amount, 50000) as loan_amount,
      ld.status as lead_status,
      u.current_address as address,
      u.city,
      u.state,
      u.monthly_income,
      u.employment_type as occupation,
      u.latitude,
      u.longitude
    FROM leads ld
    LEFT JOIN users u ON ld.user_id = u.id
    WHERE ld.assigned_to = 388
  `);

  for (const l of assignedLeads) {
    const loanId = 'LN-FLD-' + String(l.lead_id).padStart(6, '0');
    const loanAmount = parseFloat(l.loan_amount) || 50000;
    const emi = Math.round(loanAmount / 6);
    const amountDue = emi;
    const daysPastDue = l.lead_status === 'CLOSED' ? 0 : 15;
    const status = daysPastDue > 0 ? 'overdue' : 'current';
    const addr = l.address || (l.city ? `${l.city}, ${l.state || 'India'}` : 'Delhi NCR');

    await pool.query(`
      INSERT INTO collection_customers
      (name, phone, email, address, loan_id, loan_amount, amount_due, emi_amount, due_date, status, days_past_due, principal_balance, interest_rate, loan_tenure, remaining_tenure, occupation, monthly_income, assigned_agent_code, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-11-05', ?, ?, ?, 16.0, 12, 6, ?, ?, 'AG001', ?, ?)
    `, [
      l.name,
      l.mobile || '9999999999',
      l.email || '',
      addr,
      loanId,
      loanAmount,
      amountDue,
      emi,
      status,
      daysPastDue,
      loanAmount,
      l.occupation || 'Salaried',
      parseFloat(l.monthly_income) || 50000,
      l.latitude || 28.6139,
      l.longitude || 77.2090
    ]);
  }

  // Also sync assigned loans from loan_accounts
  const [assignedLoans] = await pool.query(`
    SELECT * FROM loan_accounts 
    WHERE assigned_agent IN ('AG001', '388', 'Collection Agent')
  `);

  for (const la of assignedLoans) {
    const [exists] = await pool.query('SELECT id FROM collection_customers WHERE loan_id = ?', [la.id]);
    if (exists.length === 0) {
      await pool.query(`
        INSERT INTO collection_customers
        (name, phone, email, address, loan_id, loan_amount, amount_due, emi_amount, due_date, status, days_past_due, principal_balance, interest_rate, loan_tenure, remaining_tenure, assigned_agent_code, latitude, longitude)
        VALUES (?, ?, ?, 'Delhi NCR', ?, ?, ?, ?, '2026-11-01', ?, 10, ?, 16.0, 12, 6, 'AG001', 28.6139, 77.2090)
      `, [
        la.borrower,
        la.phone,
        la.email || '',
        la.id,
        parseFloat(la.principal) || 50000,
        parseFloat(la.outstanding) || parseFloat(la.next_amount) || 13200,
        parseFloat(la.next_amount) || 13200,
        parseFloat(la.outstanding) > 0 ? 'overdue' : 'current',
        parseFloat(la.principal) || 50000
      ]);
    }
  }

  const [finalAssigned] = await pool.query('SELECT id, name, loan_id, amount_due, emi_amount, assigned_agent_code FROM collection_customers');
  console.log(`\nSuccessfully populated strictly assigned cases (${finalAssigned.length} cases):`);
  console.table(finalAssigned);

  process.exit(0);
}

setupAssignments().catch(err => {
  console.error(err);
  process.exit(1);
});
