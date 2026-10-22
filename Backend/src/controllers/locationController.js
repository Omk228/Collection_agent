const { query } = require('../config/db');
const { logPanelActivity } = require('../services/panelLogService');

async function recordLocationPing(req, res, next) {
  try {
    const { 
      latitude, 
      longitude, 
      accuracy, 
      batteryLevel, 
      speed, 
      address, 
      locationType, 
      isLogin 
    } = req.body;
    
    const agentCode = req.agent?.agent_code || req.body.agentCode || 'AG001';
    const agentName = req.agent?.name || req.body.agentName || 'Collection Agent';

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    const type = locationType || (isLogin ? 'LOGIN' : 'PING');
    const isLoginFlag = isLogin || type === 'LOGIN' ? 1 : 0;
    const finalAddress = address || (isLoginFlag ? 'Agent Login Session' : 'Live Field Location');

    const result = await query(`
      INSERT INTO agent_locations
      (agent_code, agent_name, latitude, longitude, accuracy, battery_level, speed, address, location_type, is_login)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      agentCode,
      agentName,
      parseFloat(latitude),
      parseFloat(longitude),
      accuracy ? parseFloat(accuracy) : 10.0,
      batteryLevel ? parseInt(batteryLevel, 10) : 85,
      speed ? parseFloat(speed) : 0,
      finalAddress,
      type,
      isLoginFlag
    ]);

    if (isLoginFlag) {
      // Audit log for login location tracking
      await query(`
        INSERT INTO agent_audit_logs 
        (agent_code, agent_name, action, entity_type, entity_id, details, ip_address, latitude, longitude)
        VALUES (?, ?, 'LOGIN_LOCATION', 'AUTH', ?, ?, ?, ?, ?)
      `, [
        agentCode,
        agentName,
        agentCode,
        `Agent login location verified: ${finalAddress}`,
        req.ip || '127.0.0.1',
        parseFloat(latitude),
        parseFloat(longitude)
      ]).catch(() => {});
    }

    // Central LMS / CRM panel_logs recording for live field location pings
    await logPanelActivity({
      panelUserId: req.agent?.id || 388,
      agentCode,
      userName: agentName,
      action: isLoginFlag ? 'LOGIN_LOCATION_VERIFIED' : 'LOCATION_PING',
      remarks: `${agentName} live GPS recorded at ${finalAddress}`,
      details: {
        accuracy: accuracy ? parseFloat(accuracy) : 10.0,
        batteryLevel: batteryLevel ? parseInt(batteryLevel, 10) : 85,
        speed: speed ? parseFloat(speed) : 0,
        address: finalAddress,
        locationType: type
      },
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.status(201).json({
      success: true,
      message: isLoginFlag ? 'Agent login location recorded successfully' : 'Location recorded',
      locationId: result.insertId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
}

async function getLocationHistory(req, res, next) {
  try {
    const agentCode = req.query.agentCode || req.agent?.agent_code;
    const date = req.query.date;
    const type = req.query.type; // 'login', 'visit', 'all'

    let sql = `SELECT * FROM agent_locations WHERE 1=1`;
    const params = [];

    // Filter by agent if not requested for all
    if (agentCode && agentCode.toLowerCase() !== 'all') {
      sql += ` AND agent_code = ?`;
      params.push(agentCode);
    }

    // Filter by specific date if provided (e.g. YYYY-MM-DD)
    if (date && date.toLowerCase() !== 'all') {
      sql += ` AND DATE(recorded_at) = ?`;
      params.push(date);
    }

    // Filter by type
    if (type === 'login') {
      sql += ` AND (is_login = 1 OR location_type = 'LOGIN' OR address LIKE '%login%')`;
    } else if (type === 'visit') {
      sql += ` AND (location_type = 'VISIT' OR (is_login = 0 AND (location_type IS NULL OR location_type != 'LOGIN')))`;
    }

    sql += ` ORDER BY recorded_at DESC LIMIT 200`;

    const rows = await query(sql, params);

    return res.json({
      success: true,
      count: rows.length,
      logs: rows.map(r => ({
        id: r.id,
        agentCode: r.agent_code,
        agentName: r.agent_name || ('Agent ' + r.agent_code),
        latitude: parseFloat(r.latitude),
        longitude: parseFloat(r.longitude),
        accuracy: parseFloat(r.accuracy) || 10,
        batteryLevel: r.battery_level,
        speed: parseFloat(r.speed) || 0,
        address: r.address || 'Delhi NCR',
        locationType: r.location_type || (r.is_login ? 'LOGIN' : 'PING'),
        loginSession: Boolean(r.is_login || r.location_type === 'LOGIN' || (r.address && r.address.toLowerCase().includes('login'))),
        timestamp: new Date(r.recorded_at).getTime(),
        recordedAt: r.recorded_at
      }))
    });
  } catch (error) {
    next(error);
  }
}

async function getLiveLocation(req, res, next) {
  try {
    const agentCode = req.query.agentCode || req.agent?.agent_code || 'AG001';

    let sql = `SELECT * FROM agent_locations`;
    const params = [];
    if (agentCode && agentCode.toLowerCase() !== 'all') {
      sql += ` WHERE agent_code = ?`;
      params.push(agentCode);
    }
    sql += ` ORDER BY recorded_at DESC LIMIT 1`;

    const rows = await query(sql, params);

    if (rows.length === 0) {
      return res.json({
        success: true,
        location: {
          agentCode,
          agentName: req.agent?.name || 'Collection Agent',
          latitude: 28.6139,
          longitude: 77.2090,
          accuracy: 10,
          batteryLevel: 90,
          speed: 0,
          address: 'Connaught Place, New Delhi',
          locationType: 'DEFAULT',
          loginSession: false,
          timestamp: new Date().toISOString()
        }
      });
    }

    const r = rows[0];
    return res.json({
      success: true,
      location: {
        id: r.id,
        agentCode: r.agent_code,
        agentName: r.agent_name,
        latitude: parseFloat(r.latitude),
        longitude: parseFloat(r.longitude),
        accuracy: parseFloat(r.accuracy) || 10,
        batteryLevel: r.battery_level,
        speed: parseFloat(r.speed) || 0,
        address: r.address || 'Delhi NCR',
        locationType: r.location_type || (r.is_login ? 'LOGIN' : 'PING'),
        loginSession: Boolean(r.is_login || r.location_type === 'LOGIN' || (r.address && r.address.toLowerCase().includes('login'))),
        timestamp: r.recorded_at
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAllAgentsLiveLocation(req, res, next) {
  try {
    // Get the most recent location for each distinct agent
    const rows = await query(`
      SELECT l1.* FROM agent_locations l1
      INNER JOIN (
        SELECT agent_code, MAX(id) as max_id
        FROM agent_locations
        GROUP BY agent_code
      ) l2 ON l1.id = l2.max_id
      ORDER BY l1.recorded_at DESC
    `);

    return res.json({
      success: true,
      count: rows.length,
      agents: rows.map(r => ({
        id: r.id,
        agentCode: r.agent_code,
        agentName: r.agent_name || ('Agent ' + r.agent_code),
        latitude: parseFloat(r.latitude),
        longitude: parseFloat(r.longitude),
        accuracy: parseFloat(r.accuracy) || 10,
        batteryLevel: r.battery_level,
        address: r.address || 'Delhi NCR',
        locationType: r.location_type || (r.is_login ? 'LOGIN' : 'PING'),
        loginSession: Boolean(r.is_login || r.location_type === 'LOGIN' || (r.address && r.address.toLowerCase().includes('login'))),
        lastRecordedAt: r.recorded_at,
        timestamp: new Date(r.recorded_at).getTime()
      }))
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  recordLocationPing,
  getLocationHistory,
  getLiveLocation,
  getAllAgentsLiveLocation
};

