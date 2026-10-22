const { query } = require('../config/db');
const { autoAssignSentCases, getActiveCollectionAgents } = require('../services/distributionService');
const { logPanelActivity } = require('../services/panelLogService');


// Auto-sync loan accounts assigned to this field collection agent by collection team/manager
// Also runs round-robin auto-assignment for any unassigned SENT_TO_COLLECTION_AGENT cases
let lastSyncTimestamp = 0;
async function syncAssignedCases(agentCode = 'AG001', force = false) {
  const now = Date.now();
  if (!force && now - lastSyncTimestamp < 30000) {
    return; // Ran recently, prevent parallel database contention and locks
  }
  lastSyncTimestamp = now;

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

    // 3. Purge only invalid mock loans; do NOT purge paid/settled loans so agents retain collection records
    await query(`
      DELETE FROM collection_customers 
      WHERE loan_id LIKE 'LN-FLD-%'
         OR loan_id = 'LN-LEAD-302457'
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

    // Fetch cases assigned to this agent with live loan_accounts and loans data
    let sql = `
      SELECT 
        cc.*,
        la.disbursed_on as la_disbursed_on,
        la.due_date as la_due_date,
        la.tenure as la_tenure,
        la.tenure_unit as la_tenure_unit,
        la.total_repayable as la_total_repayable,
        la.total_paid as la_total_paid,
        la.outstanding as la_outstanding,
        la.status as la_status,
        (SELECT COALESCE(SUM(ap.amount), 0) FROM agent_payments ap WHERE (ap.customer_id = cc.id OR ap.loan_id = cc.loan_id) AND ap.status != 'failed') as total_collected,
        l.disbursement_date as l_disbursement_date,
        l.maturity_date as l_maturity_date,
        l.interest_amount as l_interest_amount,
        l.total_payable as l_total_payable
      FROM collection_customers cc
      LEFT JOIN loan_accounts la ON (la.id = cc.loan_id OR la.application_id = cc.loan_id)
      LEFT JOIN loans l ON (l.loan_account_number = cc.loan_id)
      WHERE (cc.assigned_agent_code = ? OR cc.assigned_agent_code = "AG001" OR cc.assigned_agent_code IS NULL)
    `;
    const params = [agentCodeParam];

    if (status && status !== 'all') {
      if (status === 'SENT_TO_COLLECTION_AGENT' || status === 'field') {
        sql += ' AND (cc.status = "SENT_TO_COLLECTION_AGENT" OR cc.status = "paid" OR cc.status = "active" OR cc.status = "assigned")';
      } else if (status === 'current') {
        sql += ' AND (cc.status = "current" OR cc.status = "active" OR cc.status = "paid" OR cc.days_past_due <= 30)';
      } else if (status === 'overdue') {
        sql += ' AND (cc.status = "overdue" OR cc.status = "delinquent" OR cc.days_past_due > 0)';
      } else {
        sql += ' AND cc.status = ?';
        params.push(status);
      }
    }

    // SMA Bucket filtering: SMA-0 (1-30), SMA-1 (31-60), SMA-2 (61-90), NPA (>90)
    if (bucket) {
      const b = bucket.toUpperCase();
      if (b === 'SMA-0') {
        sql += ' AND cc.days_past_due BETWEEN 1 AND 30';
      } else if (b === 'SMA-1') {
        sql += ' AND cc.days_past_due BETWEEN 31 AND 60';
      } else if (b === 'SMA-2') {
        sql += ' AND cc.days_past_due BETWEEN 61 AND 90';
      } else if (b === 'NPA' || b === 'SMA-3') {
        sql += ' AND cc.days_past_due > 90';
      }
    }

    if (search) {
      sql += ' AND (cc.name LIKE ? OR cc.phone LIKE ? OR cc.loan_id LIKE ? OR cc.address LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY cc.amount_due DESC';

    let rows = [];
    try {
      rows = await query(sql, params);
    } catch (e) {
      console.warn('[DB Error] getCustomers complex query failed, trying fallback query:', e.message);
      try {
        rows = await query('SELECT * FROM collection_customers ORDER BY id DESC');
      } catch (err2) {
        console.error('[DB Error] Fallback query failed:', err2.message);
        rows = [];
      }
    }

    if (!rows || rows.length === 0) {
      try {
        const fallbackRows = await query('SELECT * FROM collection_customers ORDER BY id DESC LIMIT 50');
        if (fallbackRows && fallbackRows.length > 0) {
          rows = fallbackRows;
        }
      } catch (_) {}
    }

    if (!rows || rows.length === 0) {
      rows = [];
    }

    const agentLat = lat ? parseFloat(lat) : null;
    const agentLng = lng ? parseFloat(lng) : null;

    let formattedCustomers = rows.map((c, idx) => {
      let cLat = c.latitude ? parseFloat(c.latitude) : null;
      let cLng = c.longitude ? parseFloat(c.longitude) : null;
      let hasLiveCoords = Boolean(cLat && cLng && !isNaN(cLat) && !isNaN(cLng));

      let distanceKm = 0;
      if (hasLiveCoords && agentLat !== null && agentLng !== null) {
        const dLat = (cLat - agentLat) * (Math.PI / 180);
        const dLng = (cLng - agentLng) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(agentLat * (Math.PI / 180)) * Math.cos(cLat * (Math.PI / 180)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const cDist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceKm = Math.round(6371 * cDist * 10) / 10;
      }

      // Calculate bucket
      const dpd = c.days_past_due || 0;
      let calculatedBucket = 'Current';
      if (dpd > 90) calculatedBucket = 'NPA';
      else if (dpd > 60) calculatedBucket = 'SMA-2';
      else if (dpd > 30) calculatedBucket = 'SMA-1';
      else if (dpd > 0) calculatedBucket = 'SMA-0';

      const tenureValue = parseInt(c.la_tenure || c.loan_tenure, 10) || 30;
      const tenureUnit = c.la_tenure_unit || (tenureValue > 12 ? 'days' : 'months');
      const disbursedOn = c.la_disbursed_on || (c.l_disbursement_date ? new Date(c.l_disbursement_date).toISOString().split('T')[0] : (c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : 'N/A'));
      const dueDateFormatted = c.la_due_date || (c.l_maturity_date ? new Date(c.l_maturity_date).toISOString().split('T')[0] : (c.due_date ? new Date(c.due_date).toISOString().split('T')[0] : 'N/A'));
      const totalRepayable = parseFloat(c.la_total_repayable) || parseFloat(c.l_total_payable) || parseFloat(c.loan_amount) || parseFloat(c.amount_due) || 0;
      const totalPaid = Math.max(parseFloat(c.la_total_paid) || 0, parseFloat(c.total_collected) || 0);
      const totalInterest = parseFloat(c.l_interest_amount) || Math.max(0, totalRepayable - (parseFloat(c.loan_amount) || 0));

      const isPaid = (c.status === 'paid') ||
                     (c.la_status && ['Settled', 'Closed', 'SETTLED', 'CLOSED'].includes(c.la_status)) ||
                     (parseFloat(c.amount_due) <= 0) ||
                     (c.la_outstanding !== null && c.la_outstanding !== undefined && parseFloat(c.la_outstanding) <= 0 && totalPaid > 0) ||
                     (totalRepayable > 0 && totalPaid >= totalRepayable);

      const resolvedAmountDue = isPaid ? 0 : Math.max(0, parseFloat(c.amount_due) || 0);
      const resolvedStatus = isPaid ? 'paid' : c.status;

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        loanAmount: parseFloat(c.loan_amount) || 0,
        amountDue: resolvedAmountDue,
        totalRepayable,
        totalPaid,
        totalInterest,
        isPaid,
        loan: resolvedAmountDue > 0 ? resolvedAmountDue : (parseFloat(c.loan_amount) || 0),
        lastPayment: c.last_payment ? new Date(c.last_payment).toISOString().split('T')[0] : (totalPaid > 0 ? new Date().toISOString().split('T')[0] : 'N/A'),
        status: resolvedStatus,
        daysPastDue: dpd,
        bucket: calculatedBucket,
        distanceKm,
        email: c.email || '',
        photoId: c.photo_id || null,
        loanId: c.loan_id,
        emiAmount: parseFloat(c.emi_amount) || 0,
        dueDate: dueDateFormatted,
        loanStartDate: disbursedOn,
        loanEndDate: dueDateFormatted,
        disbursedOn: disbursedOn,
        overdueDays: c.overdue_days || dpd,
        principalBalance: parseFloat(c.principal_balance) || 0,
        interestRate: parseFloat(c.interest_rate) || 16.0,
        loanTenure: tenureValue,
        remainingTenure: c.remaining_tenure ? parseInt(c.remaining_tenure, 10) : tenureValue,
        tenureUnit: tenureUnit,
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

    // Check central loan_accounts and loans table for additional terms, tenure & bank info
    const loanRows = await query('SELECT * FROM loan_accounts WHERE id = ? OR application_id = ?', [c.loan_id, c.loan_id]);
    const loanAcc = loanRows[0] || {};

    const loansRows = await query('SELECT * FROM loans WHERE loan_account_number = ? OR lead_id = ?', [c.loan_id, c.id]);
    const loanDb = loansRows[0] || {};

    // Check users and leads table for employment/income details if missing
    let userProfile = null;
    let leadProfile = null;
    try {
      const cleanPhone = (c.phone || '').replace(/[\s\-\+]/g, '').replace(/^91/, '').replace(/^0/, '');
      const uRows = await query(`
        SELECT * FROM users 
        WHERE phone LIKE ? 
           OR email = ? 
           OR REPLACE(REPLACE(REPLACE(phone, '+91', ''), ' ', ''), '-', '') LIKE ?
        LIMIT 1
      `, [`%${cleanPhone}%`, c.email || '', `%${cleanPhone}%`]);
      if (uRows.length > 0) userProfile = uRows[0];

      const lRows = await query(`
        SELECT * FROM leads 
        WHERE mobile LIKE ? 
           OR email = ? 
           OR lead_number = ? 
           OR CONCAT('LN-', lead_number) = ? 
           OR loan_id = ?
        LIMIT 1
      `, [`%${cleanPhone}%`, c.email || '', c.loan_id ? c.loan_id.replace(/^LN-/, '') : '', c.loan_id, c.loan_id]);
      if (lRows.length > 0) leadProfile = lRows[0];
    } catch (_) {}

    const resolvedMonthlyIncome = parseFloat(c.monthly_income) || parseFloat(userProfile?.monthly_income) || parseFloat(leadProfile?.monthly_income) || 0;
    const resolvedOccupation = c.occupation || userProfile?.designation || userProfile?.employment_type || (leadProfile ? 'Salaried' : '');
    const resolvedAddress = c.address && c.address !== 'Delhi NCR' ? c.address : (userProfile?.current_address || c.address);

    // Extract dynamic references from users table and lead_references table
    const references = [];
    if (userProfile) {
      for (let i = 1; i <= 5; i++) {
        const refName = userProfile[`reference${i}_name`];
        const refPhone = userProfile[`reference${i}_phone`];
        const refRelation = userProfile[`reference${i}_relation`] || 'Reference';
        if (refName && refPhone) {
          references.push({
            name: refName,
            phone: refPhone,
            relation: refRelation,
            email: userProfile[`reference${i}_email`] || '',
            address: userProfile[`reference${i}_address`] || ''
          });
        }
      }
    }

    // Also check lead_references table
    try {
      const lrRows = await query(
        'SELECT name, relationship as relation, mobile as phone, email, address FROM lead_references WHERE lead_id = ? OR user_id = ?',
        [leadProfile?.id || c.id, userProfile?.id || c.id]
      );
      for (const lr of lrRows) {
        if (lr.name && lr.phone && !references.some(r => r.phone === lr.phone)) {
          references.push({
            name: lr.name,
            phone: lr.phone,
            relation: lr.relation || 'Reference',
            email: lr.email || '',
            address: lr.address || ''
          });
        }
      }
    } catch (_) {}

    const primaryRef = references[0] || null;
    const resolvedCoApplicantName = c.co_applicant_name || primaryRef?.name || '';
    const resolvedCoApplicantPhone = c.co_applicant_phone || primaryRef?.phone || '';
    const resolvedCoApplicantRelation = primaryRef?.relation || 'Reference';

    const tenureValue = parseInt(loanAcc.tenure || loanDb.tenure_days || c.loan_tenure, 10) || 30;
    const tenureUnit = loanAcc.tenure_unit || (tenureValue > 12 ? 'days' : 'months');
    const remainingTenure = loanAcc.days_remaining !== undefined && loanAcc.days_remaining !== null 
      ? parseInt(loanAcc.days_remaining, 10) 
      : (c.remaining_tenure ? parseInt(c.remaining_tenure, 10) : tenureValue);

    const disbursedOn = loanAcc.disbursed_on || (loanDb.disbursement_date ? new Date(loanDb.disbursement_date).toISOString().split('T')[0] : (c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : 'N/A'));
    const dueDateFormatted = loanAcc.due_date || (loanDb.maturity_date ? new Date(loanDb.maturity_date).toISOString().split('T')[0] : (c.due_date ? new Date(c.due_date).toISOString().split('T')[0] : 'N/A'));

    const originalPrincipal = parseFloat(loanAcc.principal) || parseFloat(loanDb.principal_amount) || parseFloat(c.loan_amount) || 0;
    const totalRepayable = parseFloat(loanAcc.total_repayable) || parseFloat(loanDb.total_payable) || parseFloat(c.amount_due) || originalPrincipal;
    const agentPayments = await query('SELECT COALESCE(SUM(amount), 0) as total FROM agent_payments WHERE (customer_id = ? OR loan_id = ?) AND status != "failed"', [c.id, c.loan_id]).catch(() => [{ total: 0 }]);
    const totalPaid = Math.max(parseFloat(loanAcc.total_paid) || 0, parseFloat(agentPayments[0]?.total) || 0);
    const totalInterest = parseFloat(loanDb.interest_amount) || Math.max(0, totalRepayable - originalPrincipal);

    const isPaid = (c.status === 'paid') ||
                   (loanAcc.status && ['Settled', 'Closed', 'SETTLED', 'CLOSED'].includes(loanAcc.status)) ||
                   (parseFloat(c.amount_due) <= 0) ||
                   (loanAcc.outstanding !== null && loanAcc.outstanding !== undefined && parseFloat(loanAcc.outstanding) <= 0 && totalPaid > 0) ||
                   (totalRepayable > 0 && totalPaid >= totalRepayable);

    const resolvedAmountDue = isPaid ? 0 : (parseFloat(c.amount_due) || parseFloat(loanAcc.outstanding) || originalPrincipal);
    const resolvedStatus = isPaid ? 'paid' : c.status;

    const customer = {
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: resolvedAddress,
      loanAmount: originalPrincipal,
      amountDue: resolvedAmountDue,
      totalRepayable: totalRepayable,
      totalPaid: totalPaid,
      totalInterest: totalInterest,
      disbursedOn: disbursedOn,
      loanStartDate: disbursedOn,
      loanEndDate: dueDateFormatted,
      lastPayment: c.last_payment ? new Date(c.last_payment).toISOString().split('T')[0] : (totalPaid > 0 ? new Date().toISOString().split('T')[0] : 'N/A'),
      status: resolvedStatus,
      isPaid,
      daysPastDue: c.days_past_due || 0,
      email: c.email || '',
      photoId: c.photo_id || null,
      loanId: c.loan_id,
      emiAmount: parseFloat(c.emi_amount) || 0,
      dueDate: dueDateFormatted,
      overdueDays: c.overdue_days || 0,
      principalBalance: parseFloat(c.principal_balance) || originalPrincipal,
      interestRate: parseFloat(c.interest_rate) || parseFloat(loanAcc.interest_rate) || 0,
      loanTenure: tenureValue,
      remainingTenure: remainingTenure,
      tenureUnit: tenureUnit,
      coApplicantName: resolvedCoApplicantName,
      coApplicantPhone: resolvedCoApplicantPhone,
      coApplicantRelation: resolvedCoApplicantRelation,
      references: references,
      occupation: resolvedOccupation,
      monthlyIncome: resolvedMonthlyIncome,
      latitude: c.latitude ? parseFloat(c.latitude) : (userProfile?.latitude ? parseFloat(userProfile.latitude) : null),
      longitude: c.longitude ? parseFloat(c.longitude) : (userProfile?.longitude ? parseFloat(userProfile.longitude) : null),
      bankDetails: {
        bankName: loanAcc.bank_name || userProfile?.bank_name || 'N/A',
        accountNumber: loanAcc.bank_account_no ? `••••${loanAcc.bank_account_no.slice(-4)}` : (userProfile?.account_number ? `••••${userProfile.account_number.slice(-4)}` : 'N/A'),
        ifsc: loanAcc.bank_ifsc || userProfile?.ifsc_code || 'N/A'
      },
      paymentHistory: payments.map(p => {
        const amt = parseFloat(p.amount) || 0;
        return {
          id: p.id,
          receiptNumber: p.receipt_number,
          amount: amt,
          principalAmount: Math.floor(amt * 0.7),
          interestAmount: Math.floor(amt * 0.3),
          penalty: 0,
          mode: p.payment_mode,
          date: p.payment_date,
          status: p.status,
          reference: p.transaction_reference,
          notes: p.notes
        };
      }),
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
        VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE(), 'overdue', 0, ?, 16.0, 30, 30, ?, NULL, NULL)
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
