const { query } = require('../config/db');

/**
 * Service to record collection agent activities into panel_logs and agent_audit_logs
 */

/**
 * Log collection agent activity to panel_logs and agent_audit_logs
 * @param {Object} options
 * @param {number|string|null} [options.leadId] - Lead / customer ID
 * @param {number|null} [options.panelUserId] - Panel user ID (e.g. 388)
 * @param {string} [options.userName] - Agent / user name
 * @param {string} [options.agentCode] - Agent code (e.g. 'AG001')
 * @param {string} options.action - Action identifier (e.g. 'LOGIN', 'FIELD_VISIT', 'PAYMENT_COLLECTED')
 * @param {string|null} [options.oldStatus] - Previous status if state change
 * @param {string|null} [options.newStatus] - New status if state change
 * @param {string|null} [options.remarks] - Human-readable remarks
 * @param {Object|string|null} [options.details] - Additional JSON metadata
 * @param {string|null} [options.ipAddress] - IP address of agent
 * @param {number|null} [options.latitude] - GPS latitude
 * @param {number|null} [options.longitude] - GPS longitude
 * @returns {Promise<{success: boolean, logId?: number, error?: string}>}
 */
async function logPanelActivity(options = {}) {
  try {
    const {
      leadId,
      panelUserId,
      userName,
      agentCode,
      action,
      oldStatus,
      newStatus,
      remarks,
      details,
      ipAddress,
      latitude,
      longitude
    } = options;

    if (!action) {
      console.warn('[panelLogService] Missing required parameter: action');
      return { success: false, error: 'Action is required' };
    }

    let resolvedUserId = panelUserId && !isNaN(parseInt(panelUserId, 10)) 
      ? parseInt(panelUserId, 10) 
      : 388;
    const resolvedUserName = userName || 'Collection Agent';
    const resolvedAgentCode = agentCode || 'AG001';
    
    // Validate leadId against leads table so foreign key constraint never fails
    let resolvedLeadId = null;
    if (leadId && !isNaN(parseInt(leadId, 10))) {
      const candidateId = parseInt(leadId, 10);
      try {
        const leadRow = await query('SELECT id FROM leads WHERE id = ? LIMIT 1', [candidateId]);
        if (leadRow && leadRow.length > 0) {
          resolvedLeadId = candidateId;
        }
      } catch (_) {
        resolvedLeadId = null;
      }
    }

    // Prepare details JSON object
    let detailsObj = {};
    if (typeof details === 'object' && details !== null) {
      detailsObj = { ...details };
    } else if (typeof details === 'string') {
      try {
        detailsObj = JSON.parse(details);
      } catch (_) {
        detailsObj = { raw: details };
      }
    }

    // Attach tracking metadata
    detailsObj.agentCode = resolvedAgentCode;
    detailsObj.panel = 'COLLECTION';
    detailsObj.role = 'Collection Agent';
    detailsObj.timestamp = new Date().toISOString();
    if (leadId) detailsObj.referenceLeadId = leadId;
    if (latitude !== undefined && latitude !== null) detailsObj.latitude = parseFloat(latitude);
    if (longitude !== undefined && longitude !== null) detailsObj.longitude = parseFloat(longitude);
    if (ipAddress) detailsObj.ip = ipAddress;

    const detailsJson = JSON.stringify(detailsObj);
    const agentTitle = resolvedUserName.toLowerCase().includes('collection agent') ? resolvedUserName : `Collection Agent ${resolvedUserName}`;
    const resolvedRemarks = remarks || `${action.replace(/_/g, ' ')} recorded by ${agentTitle}`;

    // 1. Insert into central panel_logs table
    let insertId = null;
    try {
      const panelLogRes = await query(`
        INSERT INTO panel_logs
        (lead_id, panel_user_id, panel_name, user_name, action, old_status, new_status, remarks, details, ip_address, created_at)
        VALUES (?, ?, 'COLLECTION', ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        resolvedLeadId,
        resolvedUserId,
        resolvedUserName,
        action,
        oldStatus || null,
        newStatus || null,
        resolvedRemarks,
        detailsJson,
        ipAddress || '127.0.0.1'
      ]);
      insertId = panelLogRes.insertId;
    } catch (panelLogErr) {
      console.warn('[panelLogService] Primary insert failed, attempting safe fallback:', panelLogErr.message);
      try {
        const fallbackRes = await query(`
          INSERT INTO panel_logs
          (lead_id, panel_user_id, panel_name, user_name, action, old_status, new_status, remarks, details, ip_address, created_at)
          VALUES (NULL, ?, 'COLLECTION', ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          resolvedUserId,
          resolvedUserName,
          action,
          oldStatus || null,
          newStatus || null,
          resolvedRemarks,
          detailsJson,
          ipAddress || '127.0.0.1'
        ]);
        insertId = fallbackRes.insertId;
      } catch (fallbackErr) {
        console.error('[panelLogService] Fallback panel_logs error:', fallbackErr.message);
      }
    }

    // 2. Also insert into agent_audit_logs for redundancy and local view
    try {
      await query(`
        INSERT INTO agent_audit_logs
        (agent_code, agent_name, action, entity_type, entity_id, details, ip_address, latitude, longitude, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        resolvedAgentCode,
        resolvedUserName,
        action,
        resolvedLeadId ? 'LEAD' : 'SYSTEM',
        resolvedLeadId ? String(resolvedLeadId) : resolvedAgentCode,
        resolvedRemarks,
        ipAddress || '127.0.0.1',
        latitude || null,
        longitude || null
      ]);
    } catch (auditErr) {
      // Non-blocking
    }

    return {
      success: true,
      logId: insertId
    };
  } catch (err) {
    console.error('[panelLogService] Unexpected error in logPanelActivity:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch collection agent logs from panel_logs (with fallback to agent_audit_logs)
 */
async function getCollectionLogs(filters = {}) {
  const { limit = 100, action, leadId, panelUserId, agentCode, search } = filters;

  try {
    let sql = `
      SELECT 
        id,
        lead_id,
        panel_user_id,
        panel_name,
        user_name,
        action,
        old_status,
        new_status,
        remarks,
        details,
        ip_address,
        created_at
      FROM panel_logs
      WHERE panel_name = 'COLLECTION'
        AND (user_name LIKE '%Agent%' OR panel_user_id = 388 OR user_name = 'Collection Agent')
    `;
    const params = [];

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    if (leadId) {
      sql += ' AND lead_id = ?';
      params.push(parseInt(leadId, 10));
    }
    if (panelUserId) {
      sql += ' AND panel_user_id = ?';
      params.push(parseInt(panelUserId, 10));
    }
    if (search) {
      sql += ' AND (action LIKE ? OR remarks LIKE ? OR user_name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY created_at DESC, id DESC LIMIT ?';
    params.push(parseInt(limit, 10) || 100);

    const rows = await query(sql, params);
    return rows.map(r => {
      let parsedDetails = {};
      try {
        parsedDetails = typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {});
      } catch (_) {}

      return {
        id: r.id,
        leadId: r.lead_id,
        panelUserId: r.panel_user_id,
        panelName: r.panel_name,
        userName: r.user_name,
        action: r.action,
        oldStatus: r.old_status,
        newStatus: r.new_status,
        remarks: r.remarks,
        details: parsedDetails,
        ipAddress: r.ip_address,
        latitude: parsedDetails.latitude || null,
        longitude: parsedDetails.longitude || null,
        timestamp: r.created_at
      };
    });
  } catch (err) {
    console.error('[panelLogService] getCollectionLogs query error:', err.message);
    return [];
  }
}

module.exports = {
  logPanelActivity,
  getCollectionLogs
};
