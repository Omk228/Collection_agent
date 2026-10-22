const { query } = require('../config/db');
const { logPanelActivity, getCollectionLogs } = require('../services/panelLogService');

/**
 * Get audit / panel logs for the collection panel
 */
async function getAuditLogs(req, res, next) {
  try {
    const { agentCode, action, limit = 100, search, source } = req.query;

    // 1. Fetch strictly from central panel_logs (where panel_name = 'COLLECTION')
    const panelLogs = await getCollectionLogs({
      limit: parseInt(limit, 10) || 100,
      action,
      search
    });

    const formattedPanelLogs = panelLogs.map(p => ({
      id: `panel_${p.id}`,
      rawId: p.id,
      leadId: p.leadId,
      panelName: 'COLLECTION',
      panelUserId: p.panelUserId,
      agentCode: p.details?.agentCode || agentCode || 'AG001',
      userName: p.userName || 'Collection Agent',
      agentName: p.userName || 'Collection Agent',
      action: p.action,
      oldStatus: p.oldStatus,
      newStatus: p.newStatus,
      remarks: p.remarks,
      details: p.details,
      ipAddress: p.ipAddress,
      latitude: p.latitude,
      longitude: p.longitude,
      timestamp: p.timestamp,
      source: 'panel_logs'
    }));

    return res.json({
      success: true,
      count: formattedPanelLogs.length,
      logs: formattedPanelLogs
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Record custom activity directly into panel_logs and agent_audit_logs
 */
async function recordCustomLog(req, res, next) {
  try {
    const { 
      action, 
      leadId,
      entityType, 
      entityId, 
      details, 
      remarks, 
      latitude, 
      longitude,
      oldStatus,
      newStatus
    } = req.body;

    const agentCode = req.agent?.agent_code || req.body.agentCode || 'AG001';
    const agentName = req.agent?.name || req.body.agentName || 'Collection Agent';
    const panelUserId = req.agent?.id || 388;

    if (!action) {
      return res.status(400).json({ success: false, message: 'Action name is required' });
    }

    const resolvedLeadId = leadId || (entityType === 'LEAD' || entityType === 'CUSTOMER' ? parseInt(entityId, 10) || null : null);
    const resolvedRemarks = remarks || (typeof details === 'string' ? details : `${action} performed by Collection Agent ${agentName}`);

    // Call panelLogService to insert into panel_logs AND agent_audit_logs
    const result = await logPanelActivity({
      leadId: resolvedLeadId,
      panelUserId,
      userName: agentName,
      agentCode,
      action,
      oldStatus: oldStatus || null,
      newStatus: newStatus || null,
      remarks: resolvedRemarks,
      details: typeof details === 'object' ? details : { details },
      ipAddress: req.ip || '127.0.0.1',
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null
    });

    return res.status(201).json({
      success: true,
      message: 'Panel log recorded successfully',
      logId: result.logId
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAuditLogs,
  recordCustomLog
};
