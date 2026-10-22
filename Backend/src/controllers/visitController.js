const { query } = require('../config/db');
const { logPanelActivity } = require('../services/panelLogService');

async function recordVisit(req, res, next) {
  try {
    const {
      customerId,
      customerName,
      loanId,
      visitType,
      latitude,
      longitude,
      locationAddress,
      photoProofUrl,
      signatureUrl,
      notes,
      outcome,
      ptpDate,
      ptpAmount
    } = req.body;

    if (!customerId && !loanId) {
      return res.status(400).json({ success: false, message: 'Customer ID or Loan ID is required' });
    }

    const agentCode = req.agent?.agent_code || req.body.agentCode || 'AG001';
    const agentName = req.agent?.name || req.body.agentName || 'Collection Agent';

    const visitCode = 'VST-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);

    const result = await query(`
      INSERT INTO agent_visits
      (visit_code, agent_code, agent_name, customer_id, customer_name, loan_id, visit_type, latitude, longitude, location_address, photo_proof_url, signature_url, notes, outcome, ptp_date, ptp_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      visitCode,
      agentCode,
      agentName,
      customerId || 1,
      customerName || 'Customer #' + customerId,
      loanId || 'LN000',
      visitType || 'regular_followup',
      latitude || 28.6139,
      longitude || 77.2090,
      locationAddress || 'Delhi NCR',
      photoProofUrl || null,
      signatureUrl || null,
      notes || '',
      outcome || 'visit_completed',
      ptpDate || null,
      ptpAmount ? parseFloat(ptpAmount) : null
    ]);

    // CENTRAL PTP WORKFLOW: Auto-schedule reminder in agent_tasks & update central collections
    const isPtp = outcome === 'PTP' || outcome === 'ptp_obtained' || Boolean(ptpDate);
    if (isPtp) {
      const scheduledPtpDate = ptpDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      try {
        await query(`
          INSERT INTO agent_tasks
          (agent_code, customer_id, customer_name, title, description, task_type, due_date, due_time, location, priority, status)
          VALUES (?, ?, ?, ?, ?, 'call', ?, '10:00 AM', ?, 'high', 'pending')
        `, [
          agentCode,
          customerId || null,
          customerName || 'Borrower',
          `PTP Follow-up: ${customerName || 'Borrower'}`,
          `Collect promised payment of ₹${ptpAmount || 'N/A'}. Field notes: ${notes || ''}`,
          scheduledPtpDate,
          locationAddress || 'On Field'
        ]);
      } catch (err) {
        console.warn('[Sync Warning] PTP agent_tasks insert:', err.message);
      }

      try {
        await query(`
          UPDATE collections
          SET promise_date = ?,
              follow_up_status = 'PTP',
              last_follow_up = NOW(),
              next_follow_up = ?,
              remarks = CONCAT(COALESCE(remarks, ''), ' | Visit PTP by ', ?)
          WHERE invoice_no = ? OR customer_name = ?
        `, [scheduledPtpDate, scheduledPtpDate, agentName, loanId || '', customerName || '']);
      } catch (err) {
        console.warn('[Sync Warning] collections promise_date update:', err.message);
      }
    }

    // Audit log
    await query(`
      INSERT INTO agent_audit_logs 
      (agent_code, agent_name, action, entity_type, entity_id, details, latitude, longitude)
      VALUES (?, ?, 'VISIT_RECORDED', 'VISIT', ?, ?, ?, ?)
    `, [
      agentCode,
      agentName,
      visitCode,
      `Visited ${customerName || 'customer'} - Outcome: ${outcome || 'completed'} (PTP: ${isPtp ? 'Yes, ' + ptpDate : 'No'})`,
      latitude || null,
      longitude || null
    ]).catch(() => {});

    // Central LMS / CRM panel_logs recording
    await logPanelActivity({
      leadId: customerId || null,
      panelUserId: req.agent?.id || 388,
      agentCode,
      userName: agentName,
      action: 'FIELD_VISIT',
      newStatus: outcome || 'VISIT_COMPLETED',
      remarks: `Field visit recorded for ${customerName || 'Borrower'} (${loanId || 'N/A'}) - Outcome: ${outcome || 'completed'}${isPtp ? ` (PTP: ₹${ptpAmount || 0} by ${ptpDate})` : ''}`,
      details: {
        visitCode,
        visitType: visitType || 'regular_followup',
        customerName,
        loanId,
        outcome,
        isPtp,
        ptpDate,
        ptpAmount,
        notes,
        locationAddress,
        photoProofUrl,
        signatureUrl
      },
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.status(201).json({
      success: true,
      message: 'Visit recorded successfully',
      visit: {
        id: result.insertId,
        visitCode,
        customerId,
        customerName,
        outcome: outcome || 'visit_completed',
        ptpScheduled: isPtp,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getVisits(req, res, next) {
  try {
    const { agentCode, customerId, date, limit } = req.query;

    let sql = 'SELECT * FROM agent_visits WHERE 1=1';
    const params = [];

    if (agentCode) {
      sql += ' AND agent_code = ?';
      params.push(agentCode);
    }
    if (customerId) {
      sql += ' AND customer_id = ?';
      params.push(customerId);
    }
    if (date) {
      sql += ' AND DATE(created_at) = ?';
      params.push(date);
    }

    sql += ' ORDER BY created_at DESC';
    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit, 10));
    }

    const rows = await query(sql, params);

    return res.json({
      success: true,
      count: rows.length,
      visits: rows.map(v => ({
        id: v.id,
        visitCode: v.visit_code,
        agentCode: v.agent_code,
        agentName: v.agent_name,
        customerId: v.customer_id,
        customerName: v.customer_name,
        loanId: v.loan_id,
        visitType: v.visit_type,
        latitude: parseFloat(v.latitude),
        longitude: parseFloat(v.longitude),
        locationAddress: v.location_address,
        photoProofUrl: v.photo_proof_url,
        signatureUrl: v.signature_url,
        notes: v.notes,
        outcome: v.outcome,
        ptpDate: v.ptp_date,
        ptpAmount: v.ptp_amount ? parseFloat(v.ptp_amount) : null,
        createdAt: v.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
}

async function getVisitAnalytics(req, res, next) {
  try {
    const agentCode = req.query.agentCode || req.agent?.agent_code;
    const today = new Date().toISOString().split('T')[0];

    const todayCount = await query(`
      SELECT COUNT(*) as count FROM agent_visits 
      WHERE (? IS NULL OR agent_code = ?) AND DATE(created_at) = ?
    `, [agentCode || null, agentCode || null, today]);

    const weekCount = await query(`
      SELECT COUNT(*) as count FROM agent_visits 
      WHERE (? IS NULL OR agent_code = ?) AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `, [agentCode || null, agentCode || null]);

    const monthCount = await query(`
      SELECT COUNT(*) as count FROM agent_visits 
      WHERE (? IS NULL OR agent_code = ?) AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, [agentCode || null, agentCode || null]);

    const outcomes = await query(`
      SELECT outcome, COUNT(*) as count 
      FROM agent_visits 
      WHERE (? IS NULL OR agent_code = ?)
      GROUP BY outcome
    `, [agentCode || null, agentCode || null]);

    return res.json({
      success: true,
      counts: {
        today: parseInt(todayCount[0].count) || 0,
        week: parseInt(weekCount[0].count) || 0,
        month: parseInt(monthCount[0].count) || 0
      },
      outcomes: outcomes.reduce((acc, row) => {
        acc[row.outcome] = row.count;
        return acc;
      }, {})
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  recordVisit,
  getVisits,
  getVisitAnalytics
};
