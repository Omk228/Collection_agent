const { query } = require('../config/db');
const { logPanelActivity } = require('../services/panelLogService');

async function getCashStatus(req, res, next) {
  try {
    const agentCode = req.query.agentCode || req.agent?.agent_code || 'AG001';

    // 1. Total cash collected by agent
    const cashCollectedRows = await query(`
      SELECT COALESCE(SUM(amount), 0) as totalCashCollected
      FROM agent_payments
      WHERE agent_code = ? AND payment_mode = 'cash' AND status = 'success'
    `, [agentCode]);

    // 2. Total cash submitted and approved/pending
    const cashSubmittedRows = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status IN ('APPROVED', 'PENDING') THEN amount ELSE 0 END), 0) as totalCashSubmitted,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) as pendingApproval,
        COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0) as verifiedSubmitted
      FROM cash_submissions
      WHERE agent_code = ?
    `, [agentCode]);

    const totalCollected = parseFloat(cashCollectedRows[0].totalCashCollected) || 0;
    const totalSubmitted = parseFloat(cashSubmittedRows[0].totalCashSubmitted) || 0;
    const unsubmittedCash = Math.max(0, totalCollected - totalSubmitted);

    // 3. Submissions history
    const submissions = await query(`
      SELECT * FROM cash_submissions 
      WHERE agent_code = ? 
      ORDER BY created_at DESC 
      LIMIT 20
    `, [agentCode]);

    // 4. Recent cash collections
    const recentCashCollections = await query(`
      SELECT id, receipt_number, customer_id, customer_name, amount, payment_date, status
      FROM agent_payments
      WHERE agent_code = ? AND payment_mode = 'cash'
      ORDER BY payment_date DESC
      LIMIT 10
    `, [agentCode]);

    return res.json({
      success: true,
      cashInHand: unsubmittedCash,
      totalCashCollected: totalCollected,
      totalCashSubmitted: totalSubmitted,
      pendingApproval: parseFloat(cashSubmittedRows[0].pendingApproval) || 0,
      verifiedSubmitted: parseFloat(cashSubmittedRows[0].verifiedSubmitted) || 0,
      submissions: submissions.map(s => {
        let denoms = {};
        try {
          denoms = typeof s.denominations === 'string' ? JSON.parse(s.denominations) : s.denominations;
        } catch (e) {}
        return {
          id: s.id,
          submissionCode: s.submission_code,
          amount: parseFloat(s.amount),
          denominations: denoms,
          submissionType: s.submission_type,
          status: s.status,
          notes: s.notes,
          receiptUrl: s.receipt_url,
          approvedBy: s.approved_by,
          approvedAt: s.approved_at,
          createdAt: s.created_at
        };
      }),
      recentCollections: recentCashCollections.map(c => ({
        id: c.id,
        receiptNumber: c.receipt_number,
        customerId: c.customer_id,
        customerName: c.customer_name,
        amount: parseFloat(c.amount),
        date: c.payment_date,
        status: c.status
      }))
    });
  } catch (error) {
    next(error);
  }
}

async function createSubmission(req, res, next) {
  try {
    const {
      amount,
      denominations,
      submissionType,
      notes,
      receiptUrl
    } = req.body;

    const agentCode = req.agent?.agent_code || req.body.agentCode || 'AG001';
    const agentName = req.agent?.name || req.body.agentName || 'Collection Agent';

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid submission amount' });
    }

    const submissionCode = 'CS-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);

    const result = await query(`
      INSERT INTO cash_submissions
      (submission_code, agent_code, agent_name, amount, denominations, submission_type, status, notes, receipt_url)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `, [
      submissionCode,
      agentCode,
      agentName,
      parsedAmount,
      JSON.stringify(denominations || {}),
      submissionType || 'branch',
      notes || '',
      receiptUrl || null
    ]);

    // Record audit log
    await query(`
      INSERT INTO agent_audit_logs 
      (agent_code, agent_name, action, entity_type, entity_id, details)
      VALUES (?, ?, 'CASH_SUBMISSION_CREATED', 'CASH', ?, ?)
    `, [
      agentCode,
      agentName,
      submissionCode,
      `Submitted ₹${parsedAmount} cash (${submissionType || 'branch'}) for supervisor verification`
    ]).catch(() => {});

    // Central LMS / CRM panel_logs recording
    await logPanelActivity({
      panelUserId: req.agent?.id || 388,
      agentCode,
      userName: agentName,
      action: 'CASH_SUBMISSION',
      newStatus: 'PENDING',
      remarks: `Submitted ₹${parsedAmount} cash (${submissionType || 'branch'}) under code ${submissionCode} for supervisor verification`,
      details: {
        submissionCode,
        amount: parsedAmount,
        submissionType: submissionType || 'branch',
        notes: notes || '',
        receiptUrl: receiptUrl || null
      },
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.status(201).json({
      success: true,
      message: 'Cash submission recorded and queued for verification',
      submission: {
        id: result.insertId,
        submissionCode,
        amount: parsedAmount,
        submissionType: submissionType || 'branch',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updateSubmissionStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, approvedBy, notes } = req.body;

    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    await query(`
      UPDATE cash_submissions 
      SET status = ?, approved_by = ?, approved_at = CASE WHEN ? = 'APPROVED' THEN NOW() ELSE approved_at END, notes = COALESCE(?, notes)
      WHERE id = ? OR submission_code = ?
    `, [status, approvedBy || 'Supervisor', status, notes || null, id, id]);

    return res.json({ success: true, message: `Cash submission ${status.toLowerCase()} successfully` });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCashStatus,
  createSubmission,
  updateSubmissionStatus
};
