const { query } = require('../config/db');
const { logPanelActivity } = require('../services/panelLogService');

async function getTodayAttendance(req, res, next) {
  try {
    const agentCode = req.query.agentCode || req.agent?.agent_code || 'AG001';
    const today = new Date().toISOString().split('T')[0];

    const rows = await query(`
      SELECT * FROM agent_attendance 
      WHERE agent_code = ? AND date = ?
      ORDER BY id DESC LIMIT 1
    `, [agentCode, today]);

    if (rows.length === 0) {
      return res.json({
        success: true,
        status: 'NOT_CHECKED_IN',
        attendance: null
      });
    }

    const att = rows[0];
    const isCheckedOut = Boolean(att.punch_out_time);

    return res.json({
      success: true,
      status: isCheckedOut ? 'CHECKED_OUT' : 'CHECKED_IN',
      attendance: {
        id: att.id,
        date: att.date,
        punchInTime: att.punch_in_time,
        punchOutTime: att.punch_out_time,
        punchInAddress: att.punch_in_address,
        punchOutAddress: att.punch_out_address,
        workingHours: parseFloat(att.working_hours) || 0,
        batteryLevel: att.battery_level,
        status: att.status
      }
    });
  } catch (error) {
    next(error);
  }
}

async function punchIn(req, res, next) {
  try {
    const { latitude, longitude, address, batteryLevel, deviceInfo } = req.body;
    const agentCode = req.agent?.agent_code || req.body.agentCode || 'AG001';
    const agentName = req.agent?.name || req.body.agentName || 'Collection Agent';
    const today = new Date().toISOString().split('T')[0];

    // Check if already punched in today
    const existing = await query(`
      SELECT * FROM agent_attendance 
      WHERE agent_code = ? AND date = ? AND punch_out_time IS NULL
    `, [agentCode, today]);

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Already punched in for today' });
    }

    const now = new Date();
    const result = await query(`
      INSERT INTO agent_attendance
      (agent_code, date, punch_in_time, punch_in_lat, punch_in_lng, punch_in_address, battery_level, device_info, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PRESENT')
    `, [
      agentCode,
      today,
      now,
      latitude || 28.6139,
      longitude || 77.2090,
      address || 'Central Delhi District',
      batteryLevel || 85,
      deviceInfo || 'Mobile Web'
    ]);

    // Also update agent shift_active status
    await query('UPDATE collection_agents SET shift_active = 1 WHERE agent_code = ?', [agentCode]);

    // Audit log
    await query(`
      INSERT INTO agent_audit_logs 
      (agent_code, agent_name, action, entity_type, entity_id, details, latitude, longitude)
      VALUES (?, ?, 'PUNCH_IN', 'ATTENDANCE', ?, ?, ?, ?)
    `, [agentCode, agentName, String(result.insertId), `Punched in at ${address || 'Location'}`, latitude || null, longitude || null]).catch(() => {});

    // Central LMS / CRM panel_logs recording
    await logPanelActivity({
      panelUserId: req.agent?.id || 388,
      agentCode,
      userName: agentName,
      action: 'SHIFT_START',
      remarks: `${agentName} started shift / punched in at ${address || 'Delhi NCR'}`,
      details: {
        punchInTime: now.toISOString(),
        batteryLevel: batteryLevel || 85,
        deviceInfo: deviceInfo || 'Mobile Web',
        address: address || 'Delhi NCR'
      },
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.status(201).json({
      success: true,
      message: 'Punched in successfully',
      attendanceId: result.insertId,
      punchInTime: now.toISOString()
    });
  } catch (error) {
    next(error);
  }
}

async function punchOut(req, res, next) {
  try {
    const { latitude, longitude, address } = req.body;
    const agentCode = req.agent?.agent_code || req.body.agentCode || 'AG001';
    const agentName = req.agent?.name || req.body.agentName || 'Collection Agent';
    const today = new Date().toISOString().split('T')[0];

    // Find active punch in
    const existing = await query(`
      SELECT * FROM agent_attendance 
      WHERE agent_code = ? AND date = ? AND punch_out_time IS NULL
      ORDER BY id DESC LIMIT 1
    `, [agentCode, today]);

    if (existing.length === 0) {
      return res.status(400).json({ success: false, message: 'No active punch-in found to punch out' });
    }

    const att = existing[0];
    const now = new Date();
    const inTime = new Date(att.punch_in_time);
    const diffHours = Math.max(0, (now.getTime() - inTime.getTime()) / (1000 * 60 * 60));

    await query(`
      UPDATE agent_attendance
      SET punch_out_time = ?, punch_out_lat = ?, punch_out_lng = ?, punch_out_address = ?, working_hours = ?
      WHERE id = ?
    `, [now, latitude || null, longitude || null, address || 'Central Delhi', diffHours.toFixed(2), att.id]);

    // Update agent shift_active
    await query('UPDATE collection_agents SET shift_active = 0 WHERE agent_code = ?', [agentCode]);

    // Audit log
    await query(`
      INSERT INTO agent_audit_logs 
      (agent_code, agent_name, action, entity_type, entity_id, details, latitude, longitude)
      VALUES (?, ?, 'PUNCH_OUT', 'ATTENDANCE', ?, ?, ?, ?)
    `, [agentCode, agentName, String(att.id), `Punched out with ${diffHours.toFixed(2)} working hours`, latitude || null, longitude || null]).catch(() => {});

    // Central LMS / CRM panel_logs recording
    await logPanelActivity({
      panelUserId: req.agent?.id || 388,
      agentCode,
      userName: agentName,
      action: 'SHIFT_END',
      remarks: `${agentName} ended shift / punched out (${diffHours.toFixed(2)} working hours)`,
      details: {
        punchOutTime: now.toISOString(),
        punchInTime: att.punch_in_time,
        workingHours: diffHours.toFixed(2),
        address: address || 'Delhi NCR'
      },
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({
      success: true,
      message: 'Punched out successfully',
      punchOutTime: now.toISOString(),
      workingHours: diffHours.toFixed(2)
    });
  } catch (error) {
    next(error);
  }
}

async function getAttendanceHistory(req, res, next) {
  try {
    const agentCode = req.query.agentCode || req.agent?.agent_code || 'AG001';

    const rows = await query(`
      SELECT * FROM agent_attendance 
      WHERE agent_code = ?
      ORDER BY date DESC, id DESC
      LIMIT 30
    `, [agentCode]);

    return res.json({
      success: true,
      history: rows.map(r => ({
        id: r.id,
        date: r.date,
        punchInTime: r.punch_in_time,
        punchOutTime: r.punch_out_time,
        punchInAddress: r.punch_in_address,
        punchOutAddress: r.punch_out_address,
        workingHours: parseFloat(r.working_hours) || 0,
        batteryLevel: r.battery_level,
        status: r.status
      }))
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTodayAttendance,
  punchIn,
  punchOut,
  getAttendanceHistory
};
