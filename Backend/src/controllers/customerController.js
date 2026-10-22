const { query } = require('../config/db');
const { autoAssignSentCases, getActiveCollectionAgents } = require('../services/distributionService');
const { logPanelActivity } = require('../services/panelLogService');


// Auto-sync loan accounts assigned to this field collection agent by collection team/manager
// Also runs round-robin auto-assignment for any unassigned SENT_TO_COLLECTION_AGENT cases
async function syncAssignedCases(agentCode = 'AG001') {
  try {
    // 1. Run Round-Robin Auto-Assignment across active collection agents
    await autoAssignSentCases();

    // 2. Find user info for this specific agent
    const agentRecords = await query('SELECT id, agent_code, name, email FROM collection_agents WHERE agent_code = ?', [agentCode]);
    let agentUserId = 388;
    let agentName = 'Collection Agent';

    if (agentRecords.length > 0) {
      agentName = agentRecords[0].name;
      agentUserId = agentRecords[0].id;
    } else {
      const pu = await query('SELECT id, name FROM panel_users WHERE (role = "COLLECTION AGENT" OR role = "Collection Agent") AND status = "ACTIVE" LIMIT 1');
      if (pu.length > 0) {
        agentUserId = pu[0].id;
        agentName = pu[0].name;
      }
    }

    // 3. Purge any cases from old leads table sync (LN-FLD-%) or closed/settled loans
    await query(`
      DELETE FROM collection_customers 
      WHERE loan_id LIKE 'LN-FLD-%'
         OR loan_id = 'LN-LEAD-302457'
         OR loan_id IN (SELECT id FROM loan_accounts WHERE status IN ('Closed', 'Settled', 'CLOSED', 'SETTLED'))
    `);

    // 4. Remove loans that were re-assigned to a different agent in loan_accounts
    await query(`
      DELETE FROM collection_customers 
      WHERE assigned_agent_code = ? 
        AND loan_id IN (
          SELECT id FROM loan_accounts 
          WHERE assigned_agent IS NOT NULL 
            AND assigned_agent != '' 
            AND assigned_agent NOT IN (?, ?, ?, ?)
        )
    `, [agentCode, agentCode, String(agentUserId), agentName, agentCode.toLowerCase()]);
  } catch (err) {
    console.warn('[Sync Notice] syncAssignedCases:', err.message);
  }
}

async function getCustomers(req, res, next) {
  const agentCodeParam = req.query.agentCode || req.agent?.agent_code || 'AG001';
  // Run background sync non-blocking so API responds immediately
  syncAssignedCases(agentCodeParam).catch(e => console.warn('[Sync Notice]:', e.message));

  try {
    const { search, status, bucket, near_me, lat, lng } = req.query;

    // Fetch cases assigned to this agent
    let sql = 'SELECT * FROM collection_customers WHERE (assigned_agent_code = ? OR assigned_agent_code = "AG001" OR assigned_agent_code IS NULL)';
    const params = [agentCodeParam];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    // SMA Bucket filtering: SMA-0 (1-30), SMA-1 (31-60), SMA-2 (61-90), NPA (>90)
    if (bucket) {
      const b = bucket.toUpperCase();
      if (b === 'SMA-0') {
        sql += ' AND days_past_due BETWEEN 1 AND 30';
      } else if (b === 'SMA-1') {
        sql += ' AND days_past_due BETWEEN 31 AND 60';
      } else if (b === 'SMA-2') {
        sql += ' AND days_past_due BETWEEN 61 AND 90';
      } else if (b === 'NPA' || b === 'SMA-3') {
        sql += ' AND days_past_due > 90';
      }
    }

    if (search) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR loan_id LIKE ? OR address LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY amount_due DESC';

    let rows = [];
    try {
      const queryPromise = query(sql, params);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), 3000));
      rows = await Promise.race([queryPromise, timeoutPromise]);
    } catch (e) {
      console.warn('[DB Error] getCustomers:', e.message);
      rows = [];
    }

    if (!rows || rows.length === 0) {
      rows = [];
    }

    const agentLat = lat ? parseFloat(lat) : 28.6738;
    const agentLng = lng ? parseFloat(lng) : 77.1005;

    let formattedCustomers = rows.map((c, idx) => {
      let cLat = parseFloat(c.latitude);
      let cLng = parseFloat(c.longitude);
      let hasLiveCoords = Boolean(cLat && cLng && !isNaN(cLat) && !isNaN(cLng) && cLat !== 0 && cLng !== 0);

      // If coordinates are missing, distribute across distinct stops in the agent's NCR operational territory
      if (!hasLiveCoords) {
        const clusters = [
          { lat: 28.6139, lng: 77.2090 }, // Connaught Place
          { lat: 28.5355, lng: 77.3910 }, // Noida Sector 62
          { lat: 28.4595, lng: 77.0266 }, // Gurgaon Cyber Hub
          { lat: 28.5245, lng: 77.2066 }, // Saket South Delhi
          { lat: 28.5921, lng: 77.0460 }, // Dwarka
          { lat: 28.7041, lng: 77.1025 }, // Rohini North
          { lat: 28.6507, lng: 77.1906 }, // Karol Bagh
          { lat: 28.6692, lng: 77.4538 }  // Ghaziabad
        ];
        const chosen = clusters[idx % clusters.length];
        const jitter = (((c.id || idx) * 31) % 40 - 20) * 0.0008;
        cLat = chosen.lat + jitter;
        cLng = chosen.lng + jitter;
        hasLiveCoords = true;
      }
      
      // Approximate Haversine distance in km
      const dLat = (cLat - agentLat) * (Math.PI / 180);
      const dLng = (cLng - agentLng) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(agentLat * (Math.PI / 180)) * Math.cos(cLat * (Math.PI / 180)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const cDist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceKm = Math.round(6371 * cDist * 10) / 10;

      // Calculate bucket
      const dpd = c.days_past_due || 0;
      let calculatedBucket = 'Current';
      if (dpd > 90) calculatedBucket = 'NPA';
      else if (dpd > 60) calculatedBucket = 'SMA-2';
      else if (dpd > 30) calculatedBucket = 'SMA-1';
      else if (dpd > 0) calculatedBucket = 'SMA-0';

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        loanAmount: parseFloat(c.loan_amount) || 0,
        amountDue: parseFloat(c.amount_due) || 0,
        loan: parseFloat(c.amount_due) || parseFloat(c.loan_amount) || 0,
        lastPayment: c.last_payment ? new Date(c.last_payment).toISOString().split('T')[0] : 'N/A',
        status: c.status,
        daysPastDue: dpd,
        bucket: calculatedBucket,
        distanceKm,
        email: c.email || '',
        photoId: c.photo_id || null,
        loanId: c.loan_id,
        emiAmount: parseFloat(c.emi_amount) || 0,
        dueDate: c.due_date ? new Date(c.due_date).toISOString().split('T')[0] : 'N/A',
        overdueDays: c.overdue_days || dpd,
        principalBalance: parseFloat(c.principal_balance) || 0,
        interestRate: parseFloat(c.interest_rate) || 16.0,
        loanTenure: c.loan_tenure || 24,
        remainingTenure: c.remaining_tenure || 18,
        coApplicantName: c.co_applicant_name || '',
        coApplicantPhone: c.co_applicant_phone || '',
        occupation: c.occupation || 'Salaried',
        monthlyIncome: parseFloat(c.monthly_income) || 0,
        latitude: cLat,
        longitude: cLng,
        hasLiveCoords
      };
    });

    if (near_me === 'true' || near_me === '1') {
      formattedCustomers.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return res.json({
      success: true,
      count: formattedCustomers.length,
      customers: formattedCustomers
    });
  } catch (error) {
    next(error);
  }
}

async function getCustomerById(req, res, next) {
  try {
    const { id } = req.params;
    let rows = await query('SELECT * FROM collection_customers WHERE id = ? OR loan_id = ?', [id, id]).catch(() => []);
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found in database' });
    }

    const c = rows[0];

    // Fetch payment history for this customer
    const payments = await query(`
      SELECT * FROM agent_payments 
      WHERE customer_id = ? OR loan_id = ?
      ORDER BY payment_date DESC
    `, [c.id, c.loan_id]);

    // Fetch visit history for this customer
    const visits = await query(`
      SELECT * FROM agent_visits 
      WHERE customer_id = ? OR loan_id = ?
      ORDER BY created_at DESC
    `, [c.id, c.loan_id]);

    // Check central loan_accounts table for additional bank info
    const loanRows = await query('SELECT * FROM loan_accounts WHERE id = ? OR application_id = ?', [c.loan_id, c.loan_id]);
    const loanAcc = loanRows[0] || {};

    const customer = {
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      loanAmount: parseFloat(c.loan_amount) || 0,
      amountDue: parseFloat(c.amount_due) || 0,
      lastPayment: c.last_payment ? new Date(c.last_payment).toISOString().split('T')[0] : 'N/A',
      status: c.status,
      daysPastDue: c.days_past_due || 0,
      email: c.email || '',
      photoId: c.photo_id || null,
      loanId: c.loan_id,
      emiAmount: parseFloat(c.emi_amount) || 0,
      dueDate: c.due_date ? new Date(c.due_date).toISOString().split('T')[0] : 'N/A',
      overdueDays: c.overdue_days || 0,
      principalBalance: parseFloat(c.principal_balance) || 0,
      interestRate: parseFloat(c.interest_rate) || 0,
      loanTenure: c.loan_tenure || 0,
      remainingTenure: c.remaining_tenure || 0,
      coApplicantName: c.co_applicant_name || '',
      coApplicantPhone: c.co_applicant_phone || '',
      occupation: c.occupation || '',
      monthlyIncome: parseFloat(c.monthly_income) || 0,
      latitude: parseFloat(c.latitude) || 28.6139,
      longitude: parseFloat(c.longitude) || 77.2090,
      bankDetails: {
        bankName: loanAcc.bank_name || 'N/A',
        accountNumber: loanAcc.bank_account_no ? `••••${loanAcc.bank_account_no.slice(-4)}` : 'N/A',
        ifsc: loanAcc.bank_ifsc || 'N/A'
      },
      paymentHistory: payments.map(p => ({
        id: p.id,
        receiptNumber: p.receipt_number,
        amount: parseFloat(p.amount),
        mode: p.payment_mode,
        date: p.payment_date,
        status: p.status,
        reference: p.transaction_reference,
        notes: p.notes
      })),
      visitHistory: visits.map(v => ({
        id: v.id,
        visitCode: v.visit_code,
        agentName: v.agent_name,
        visitType: v.visit_type,
        date: v.created_at,
        outcome: v.outcome,
        notes: v.notes,
        ptpDate: v.ptp_date,
        ptpAmount: v.ptp_amount,
        photoUrl: v.photo_proof_url
      }))
    };

    return res.json({ success: true, customer });
  } catch (error) {
    next(error);
  }
}

async function createCustomer(req, res, next) {
  try {
    const {
      name, phone, email, address, loanAmount, emiAmount, dueDate,
      status, principalBalance, interestRate, loanTenure, coApplicantName,
      coApplicantPhone, occupation, monthlyIncome, assignedAgentCode
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    const loanId = req.body.loanId || ('LN' + String(Date.now()).slice(-6));

    const result = await query(`
      INSERT INTO collection_customers
      (name, phone, email, address, loan_id, loan_amount, amount_due, emi_amount, due_date, status, principal_balance, interest_rate, loan_tenure, remaining_tenure, co_applicant_name, co_applicant_phone, occupation, monthly_income, assigned_agent_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, phone, email || '', address || 'Delhi NCR', loanId,
      loanAmount || 100000, loanAmount || 100000, emiAmount || 10000,
      dueDate || new Date().toISOString().split('T')[0], status || 'current',
      principalBalance || loanAmount || 100000, interestRate || 16.0,
      loanTenure || 24, loanTenure || 24, coApplicantName || '',
      coApplicantPhone || '', occupation || 'Employed', monthlyIncome || 50000,
      assignedAgentCode || 'AG001'
    ]);

    // Log to panel_logs
    await logPanelActivity({
      leadId: result.insertId || null,
      panelUserId: req.agent?.id || 388,
      userName: req.agent?.name || 'Collection Agent',
      action: 'CUSTOMER_CREATED',
      newStatus: status || 'current',
      remarks: `New customer ${name} (${loanId}) created by collection agent`,
      details: { name, phone, loanId, loanAmount, address },
      req
    }).catch(err => console.warn('[Log Warning] Customer created log:', err.message));

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      customerId: result.insertId,
      loanId
    });
  } catch (error) {
    next(error);
  }
}

async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const { name, phone, address, status, amountDue, daysPastDue } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (amountDue !== undefined) { updates.push('amount_due = ?'); params.push(amountDue); }
    if (daysPastDue !== undefined) {
      updates.push('days_past_due = ?', 'overdue_days = ?');
      params.push(daysPastDue, daysPastDue);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(id);
    await query(`UPDATE collection_customers SET ${updates.join(', ')} WHERE id = ?`, params);

    // Log to panel_logs
    await logPanelActivity({
      leadId: id,
      panelUserId: req.agent?.id || 388,
      userName: req.agent?.name || 'Collection Agent',
      action: 'CUSTOMER_UPDATED',
      newStatus: status || null,
      remarks: `Customer details updated for customer ID ${id}`,
      details: { id, updates: req.body },
      req
    }).catch(err => console.warn('[Log Warning] Customer updated log:', err.message));

    return res.json({ success: true, message: 'Customer updated successfully' });
  } catch (error) {
    next(error);
  }
}

async function assignCaseToAgent(req, res, next) {
  try {
    const { loanId, borrowerName, phone, amountDue, emiAmount, address, agentCode = 'AG001', notes } = req.body;

    if (!loanId) {
      return res.status(400).json({ success: false, message: 'loanId is required' });
    }

    // 1. If exists in loan_accounts, update assigned_agent
    await query('UPDATE loan_accounts SET assigned_agent = "Collection Agent" WHERE id = ?', [loanId]);

    // 2. Check if already in collection_customers
    const existing = await query('SELECT id FROM collection_customers WHERE loan_id = ?', [loanId]);
    if (existing.length > 0) {
      await query('UPDATE collection_customers SET assigned_agent_code = ? WHERE id = ?', [agentCode, existing[0].id]);
    } else {
      await query(`
        INSERT INTO collection_customers
        (name, phone, address, loan_id, loan_amount, amount_due, emi_amount, due_date, status, days_past_due, principal_balance, interest_rate, loan_tenure, remaining_tenure, assigned_agent_code, latitude, longitude)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), 'overdue', 15, ?, 16.0, 12, 6, ?, 28.6139, 77.2090)
      `, [
        borrowerName || 'Borrower',
        phone || '9999999999',
        address || 'Delhi NCR',
        loanId,
        parseFloat(amountDue) || 25000,
        parseFloat(amountDue) || 25000,
        parseFloat(emiAmount) || 5000,
        parseFloat(amountDue) || 25000,
        agentCode
      ]);
    }

    // 3. Log audit event
    await query(`
      INSERT INTO agent_audit_logs (agent_code, agent_name, action, entity_type, entity_id, details)
      VALUES (?, 'Collection Agent', 'CASE_ASSIGNED', 'LOAN', ?, ?)
    `, [agentCode, loanId, notes || 'Case assigned by collection manager for field recovery']);

    // 4. Log to panel_logs
    await logPanelActivity({
      leadId: loanId,
      panelUserId: req.agent?.id || 388,
      userName: 'Collection Agent',
      action: 'CASE_ASSIGNED',
      remarks: `Case ${loanId} assigned to agent ${agentCode}`,
      details: { loanId, agentCode, amountDue, notes },
      req
    }).catch(err => console.warn('[Log Warning] Case assigned log:', err.message));

    return res.json({
      success: true,
      message: `Case ${loanId} successfully assigned to agent ${agentCode}`
    });
  } catch (error) {
    next(error);
  }
}

async function triggerAutoAssign(req, res, next) {
  try {
    const result = await autoAssignSentCases();
    return res.json({
      success: true,
      message: 'Round-robin auto-assignment completed',
      ...result
    });
  } catch (error) {
    next(error);
  }
}

async function getDistributionStatus(req, res, next) {
  try {
    const activeAgents = await getActiveCollectionAgents();
    const caseCounts = await query(`
      SELECT assigned_agent_code, status, COUNT(*) as count, COALESCE(SUM(amount_due), 0) as totalDue
      FROM collection_customers
      GROUP BY assigned_agent_code, status
    `);

    return res.json({
      success: true,
      activeAgents,
      caseCounts
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  syncAssignedCases,
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  assignCaseToAgent,
  triggerAutoAssign,
  getDistributionStatus
};
