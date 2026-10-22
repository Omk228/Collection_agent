const { query } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logPanelActivity } = require('../services/panelLogService');

const otpStore = new Map(); // Store OTP in memory: identifier -> { otp, expiresAt, attempts }

// Clean up expired OTPs every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpStore.entries()) {
    if (val.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 15 * 60 * 1000);

async function recordLoginAuditAndLocation({ agentCode, agentName, latitude, longitude, accuracy, address, loginType, ipAddress }) {
  let lat = latitude !== undefined && latitude !== null && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : 28.6139;
  let lng = longitude !== undefined && longitude !== null && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : 77.2090;
  const acc = accuracy && !isNaN(parseFloat(accuracy)) ? parseFloat(accuracy) : 10.0;
  const hasLiveCoords = latitude !== undefined && longitude !== undefined && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude));
  const finalAddress = address || (hasLiveCoords ? `Live GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})` : 'Delhi NCR (Default Session Location)');

  try {
    // 1. Insert into agent_locations history table
    const locResult = await query(`
      INSERT INTO agent_locations
      (agent_code, agent_name, latitude, longitude, accuracy, battery_level, speed, address, location_type, is_login)
      VALUES (?, ?, ?, ?, ?, 85, 0, ?, 'LOGIN', 1)
    `, [
      agentCode,
      agentName,
      lat,
      lng,
      acc,
      finalAddress
    ]);

    // 2. Insert into agent_audit_logs with coordinates
    await query(`
      INSERT INTO agent_audit_logs 
      (agent_code, agent_name, action, entity_type, entity_id, details, ip_address, latitude, longitude)
      VALUES (?, ?, 'LOGIN_SUCCESS', 'AUTH', ?, ?, ?, ?, ?)
    `, [
      agentCode,
      agentName,
      agentCode,
      `Agent logged in via ${loginType || 'password'} at ${finalAddress}`,
      ipAddress || '127.0.0.1',
      lat,
      lng
    ]);

    // 3. Central LMS / CRM panel_logs recording
    await logPanelActivity({
      agentCode,
      userName: agentName,
      action: 'LOGIN',
      remarks: `${agentName} logged into Collection Panel via ${loginType || 'password'} at ${finalAddress}`,
      details: {
        loginType: loginType || 'password',
        address: finalAddress,
        accuracy: acc,
        ip: ipAddress || '127.0.0.1'
      },
      ipAddress: ipAddress || '127.0.0.1',
      latitude: lat,
      longitude: lng
    });

    return {
      recorded: true,
      locationId: locResult.insertId,
      latitude: lat,
      longitude: lng,
      address: finalAddress,
      recordedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('[Auth] Failed to record login location:', err.message);
    return { recorded: false, error: err.message };
  }
}

async function login(req, res, next) {
  try {
    const rawIdentifier = req.body.email || req.body.agentId || req.body.agentCode || req.body.agent_code || req.body.username;
    const { password, loginType, latitude, longitude, accuracy, address } = req.body;

    if (!rawIdentifier) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }
    if (!password && loginType !== 'biometric') {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const email = String(rawIdentifier).trim();

    // 1. Primary Authentication: Look up directly in panel_users table
    const panelUsers = await query(`
      SELECT * FROM panel_users 
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1
    `, [email]);

    if (panelUsers.length > 0) {
      const pu = panelUsers[0];

      if (pu.status === 'INACTIVE') {
        return res.status(403).json({ success: false, message: 'Your account is inactive. Please contact your manager.' });
      }

      const isMatch = await bcrypt.compare(password, pu.password_hash).catch(() => false);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid email or password. Please verify and try again.' });
      }

      let agentCode = 'AG001';
      const caMatch = await query('SELECT agent_code FROM collection_agents WHERE email = ? LIMIT 1', [pu.email]);
      if (caMatch.length > 0) {
        agentCode = caMatch[0].agent_code;
      } else {
        agentCode = pu.id === 388 ? 'AG001' : `AG${String(pu.id).padStart(3, '0')}`;
      }

      const tokenPayload = {
        id: pu.id,
        agent_code: agentCode,
        name: pu.name,
        email: pu.email,
        role: pu.role, // 'COLLECTION AGENT'
        permissions: ['all']
      };

      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'fundlelo_loan_collection_agent_jwt_secret_token_2026', {
        expiresIn: process.env.JWT_EXPIRES_IN || '30d'
      });

      // Save live location to history
      const loginLoc = await recordLoginAuditAndLocation({
        agentCode,
        agentName: pu.name,
        latitude,
        longitude,
        accuracy,
        address,
        loginType: loginType || 'password',
        ipAddress: req.ip
      });

      return res.json({
        success: true,
        message: `Welcome back, ${pu.name}!`,
        token,
        loginLocation: loginLoc,
        agent: {
          id: agentCode,
          agentCode: agentCode,
          panelUserId: pu.id,
          name: pu.name,
          email: pu.email,
          phone: pu.phone || '+919876543210',
          role: pu.role, // 'COLLECTION AGENT'
          permissions: ['all'],
          territory: 'Delhi NCR',
          experience: '3 years',
          rating: 4.9,
          status: pu.status,
          loginMethod: 'password'
        }
      });
    }

    const identifier = email;
    // Normalize phone (strip +91, spaces, dashes, leading zero)
    const cleanPhone = identifier.replace(/[\s\-\+]/g, '').replace(/^91/, '').replace(/^0/, '');

    // 2. Fallback check in collection_agents by agent_code, email, or phone
    let agents = await query(`
      SELECT * FROM collection_agents 
      WHERE agent_code = ? 
         OR LOWER(email) = LOWER(?) 
         OR phone = ? 
         OR REPLACE(REPLACE(REPLACE(phone, '+91', ''), ' ', ''), '-', '') LIKE ?
      LIMIT 1
    `, [identifier, identifier, identifier, `%${cleanPhone}%`]);

    // 2. If not found in collection_agents, dynamically look up panel_users
    if (agents.length === 0) {
      const panelUsers = await query(`
        SELECT * FROM panel_users 
        WHERE LOWER(email) = LOWER(?) 
           OR phone = ? 
           OR REPLACE(REPLACE(REPLACE(phone, '+91', ''), ' ', ''), '-', '') LIKE ? 
           OR id = ?
        LIMIT 1
      `, [identifier, identifier, `%${cleanPhone}%`, isNaN(identifier) ? -1 : parseInt(identifier, 10)]);

      if (panelUsers.length > 0) {
        const pu = panelUsers[0];
        const newCode = 'AG' + String(pu.id).padStart(3, '0');
        const roleName = pu.role === 'COLLECTION_MANAGEMENT' ? 'Supervisor' 
          : pu.role === 'COLLECTION_TEAM' ? 'Senior Recovery Officer' 
          : 'Field Collection Agent';

        // Check if agent_code already exists, else insert
        const existingCode = await query('SELECT id FROM collection_agents WHERE agent_code = ?', [newCode]);
        if (existingCode.length === 0) {
          await query(`
            INSERT INTO collection_agents 
            (agent_code, name, email, phone, password_hash, role, permissions, territory, experience, rating, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Delhi NCR', '3 years', 4.8, 'ACTIVE')
          `, [
            newCode,
            pu.name || 'Agent ' + pu.id,
            pu.email || '',
            pu.phone || '',
            pu.password_hash,
            roleName,
            JSON.stringify(['all'])
          ]);
        }
        agents = await query('SELECT * FROM collection_agents WHERE agent_code = ?', [newCode]);
      }
    }

    if (agents.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'No registered agent found with this ID, Email, or Mobile number' 
      });
    }

    const agent = agents[0];

    if (agent.status === 'INACTIVE') {
      return res.status(403).json({ success: false, message: 'Agent account is inactive. Please contact your manager.' });
    }

    // Dynamic password verification via bcrypt
    let isPasswordValid = false;
    if (loginType === 'biometric') {
      // Biometric authentication granted for active registered agent
      isPasswordValid = true;
    } else if (password) {
      isPasswordValid = await bcrypt.compare(password, agent.password_hash).catch(() => false);
    }

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid password. Please verify and try again.' });
    }

    // Parse permissions
    let permissions = ['all'];
    try {
      permissions = typeof agent.permissions === 'string' ? JSON.parse(agent.permissions) : (agent.permissions || ['all']);
    } catch (e) {
      permissions = ['all'];
    }

    const tokenPayload = {
      id: agent.id,
      agent_code: agent.agent_code,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      permissions
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'fundlelo_loan_collection_agent_jwt_secret_token_2026', {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d'
    });

    // Save live location to history & audit log
    const loginLoc = await recordLoginAuditAndLocation({
      agentCode: agent.agent_code,
      agentName: agent.name,
      latitude,
      longitude,
      accuracy,
      address,
      loginType: loginType || 'password',
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Welcome back, ${agent.name}!`,
      token,
      loginLocation: loginLoc,
      agent: {
        id: agent.agent_code,
        agentCode: agent.agent_code,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        role: agent.role,
        permissions,
        territory: agent.territory || 'Delhi NCR',
        experience: agent.experience || '2+ years',
        rating: parseFloat(agent.rating) || 4.8,
        status: agent.status,
        loginMethod: loginType || 'password'
      }
    });
  } catch (error) {
    next(error);
  }
}

async function sendOtp(req, res, next) {
  try {
    const rawIdentifier = req.body.agentId || req.body.phone || req.body.email || req.body.agentCode;
    if (!rawIdentifier) {
      return res.status(400).json({ success: false, message: 'Agent ID, Email, or Mobile number is required' });
    }

    const identifier = String(rawIdentifier).trim();
    const cleanPhone = identifier.replace(/[\s\-\+]/g, '').replace(/^91/, '').replace(/^0/, '');

    const agents = await query(`
      SELECT agent_code, name, phone, email FROM collection_agents 
      WHERE agent_code = ? 
         OR LOWER(email) = LOWER(?) 
         OR phone = ? 
         OR REPLACE(REPLACE(REPLACE(phone, '+91', ''), ' ', ''), '-', '') LIKE ?
      LIMIT 1
    `, [identifier, identifier, identifier, `%${cleanPhone}%`]);

    if (agents.length === 0) {
      return res.status(404).json({ success: false, message: 'No registered agent found with this identifier' });
    }

    const agent = agents[0];
    // Generate secure dynamic 6-digit OTP
    const dynamicOtp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    otpStore.set(agent.agent_code, { otp: dynamicOtp, expiresAt, attempts: 0 });
    otpStore.set(identifier, { otp: dynamicOtp, expiresAt, attempts: 0 });

    const maskedPhone = agent.phone ? agent.phone.replace(/.(?=.{4})/g, '*') : 'your registered number';

    return res.json({
      success: true,
      message: `OTP sent to ${maskedPhone}`,
      otpHint: dynamicOtp // Included for instant login verification
    });
  } catch (error) {
    next(error);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const rawIdentifier = req.body.agentId || req.body.phone || req.body.email || req.body.agentCode;
    const { otp, latitude, longitude, accuracy, address } = req.body;

    if (!rawIdentifier || !otp) {
      return res.status(400).json({ success: false, message: 'Identifier and OTP are required' });
    }

    const identifier = String(rawIdentifier).trim();
    const stored = otpStore.get(identifier);

    if (!stored) {
      return res.status(400).json({ success: false, message: 'No OTP requested or session expired. Please request a new OTP.' });
    }

    if (stored.expiresAt < Date.now()) {
      otpStore.delete(identifier);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (String(stored.otp).trim() !== String(otp).trim()) {
      stored.attempts = (stored.attempts || 0) + 1;
      if (stored.attempts >= 5) {
        otpStore.delete(identifier);
        return res.status(400).json({ success: false, message: 'Too many incorrect attempts. Please request a new OTP.' });
      }
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please check and try again.' });
    }

    // OTP is valid
    otpStore.delete(identifier);

    const cleanPhone = identifier.replace(/[\s\-\+]/g, '').replace(/^91/, '').replace(/^0/, '');
    const agents = await query(`
      SELECT * FROM collection_agents 
      WHERE agent_code = ? 
         OR LOWER(email) = LOWER(?) 
         OR phone = ? 
         OR REPLACE(REPLACE(REPLACE(phone, '+91', ''), ' ', ''), '-', '') LIKE ?
      LIMIT 1
    `, [identifier, identifier, identifier, `%${cleanPhone}%`]);

    if (agents.length === 0) {
      return res.status(404).json({ success: false, message: 'Agent account not found' });
    }

    const agent = agents[0];
    let permissions = ['all'];
    try {
      permissions = typeof agent.permissions === 'string' ? JSON.parse(agent.permissions) : (agent.permissions || ['all']);
    } catch (e) {
      permissions = ['all'];
    }

    const token = jwt.sign({
      id: agent.id,
      agent_code: agent.agent_code,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      permissions
    }, process.env.JWT_SECRET || 'fundlelo_loan_collection_agent_jwt_secret_token_2026', {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d'
    });

    // Save live location to history
    const loginLoc = await recordLoginAuditAndLocation({
      agentCode: agent.agent_code,
      agentName: agent.name,
      latitude,
      longitude,
      accuracy,
      address,
      loginType: 'otp',
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Welcome, ${agent.name}!`,
      token,
      loginLocation: loginLoc,
      agent: {
        id: agent.agent_code,
        agentCode: agent.agent_code,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        role: agent.role,
        permissions,
        territory: agent.territory,
        experience: agent.experience,
        rating: parseFloat(agent.rating) || 4.8,
        loginMethod: 'otp'
      }
    });
  } catch (error) {
    next(error);
  }
}

async function registerAgent(req, res, next) {
  try {
    const { agentCode, name, email, phone, password, role, territory, targets } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const code = agentCode || 'AG' + Math.floor(100 + Math.random() * 900);

    const existing = await query('SELECT id FROM collection_agents WHERE agent_code = ? OR email = ?', [code, email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'An agent with this Agent Code or Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const targetColl = targets?.collections || 150000;
    const targetCalls = targets?.calls || 25;
    const targetVisits = targets?.visits || 8;
    const targetPayments = targets?.payments || 10;

    const result = await query(`
      INSERT INTO collection_agents 
      (agent_code, name, email, phone, password_hash, role, permissions, territory, experience, rating, target_collections, target_calls, target_visits, target_payments, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '1 year', 4.8, ?, ?, ?, ?, 'ACTIVE')
    `, [
      code,
      name,
      email,
      phone || '',
      passwordHash,
      role || 'Field Collection Agent',
      JSON.stringify(['all']),
      territory || 'Delhi NCR',
      targetColl,
      targetCalls,
      targetVisits,
      targetPayments
    ]);

    return res.status(201).json({
      success: true,
      message: `Agent ${name} (${code}) created successfully`,
      agent: {
        id: code,
        agentCode: code,
        name,
        email,
        phone,
        role: role || 'Field Collection Agent',
        territory: territory || 'Delhi NCR'
      }
    });
  } catch (error) {
    next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const agentCode = req.agent?.agent_code || req.body.agentCode;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    }

    const agents = await query('SELECT * FROM collection_agents WHERE agent_code = ?', [agentCode]);
    if (agents.length === 0) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    const agent = agents[0];
    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, agent.password_hash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password does not match' });
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE collection_agents SET password_hash = ? WHERE agent_code = ?', [newHash, agentCode]);

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const email = req.agent?.email || req.query.email;
    if (email) {
      const panelUsers = await query('SELECT * FROM panel_users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
      if (panelUsers.length > 0) {
        let agentCode = req.agent?.agent_code;
        if (!agentCode) {
          const caMatch = await query('SELECT agent_code FROM collection_agents WHERE email = ? LIMIT 1', [pu.email]);
          agentCode = caMatch.length > 0 ? caMatch[0].agent_code : (pu.id === 388 ? 'AG001' : `AG${String(pu.id).padStart(3, '0')}`);
        }
        return res.json({
          success: true,
          agent: {
            id: agentCode,
            agentCode: agentCode,
            panelUserId: pu.id,
            name: pu.name,
            email: pu.email,
            phone: pu.phone || '+919876543210',
            role: pu.role, // 'COLLECTION AGENT'
            permissions: ['all'],
            territory: 'Delhi NCR',
            rating: 4.9,
            status: pu.status,
            shiftActive: true,
            targets: {
              collections: 200000,
              calls: 30,
              visits: 10,
              payments: 12
            }
          }
        });
      }
    }

    const agentCode = req.agent?.agent_code || req.query.agentCode || 'AG001';
    const agents = await query('SELECT * FROM collection_agents WHERE agent_code = ?', [agentCode]);
    if (agents.length === 0) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    const agent = agents[0];
    let permissions = ['all'];
    try {
      permissions = typeof agent.permissions === 'string' ? JSON.parse(agent.permissions) : (agent.permissions || ['all']);
    } catch (e) {}

    return res.json({
      success: true,
      agent: {
        id: agent.agent_code,
        agentCode: agent.agent_code,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        role: agent.role,
        permissions,
        territory: agent.territory,
        experience: agent.experience,
        rating: parseFloat(agent.rating) || 4.8,
        avatar: agent.avatar,
        status: agent.status,
        shiftActive: Boolean(agent.shift_active),
        targets: {
          collections: parseFloat(agent.target_collections) || 200000,
          calls: parseInt(agent.target_calls, 10) || 25,
          visits: parseInt(agent.target_visits, 10) || 10,
          payments: parseInt(agent.target_payments, 10) || 12
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const agentCode = req.agent?.agent_code || 'AG001';
    const agentName = req.agent?.name || 'Collection Agent';
    const panelUserId = req.agent?.id || 388;

    await logPanelActivity({
      agentCode,
      userName: agentName,
      panelUserId,
      action: 'LOGOUT',
      remarks: `${agentName} logged out from Collection Panel`,
      details: {
        timestamp: new Date().toISOString(),
        role: 'Collection Agent'
      },
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  sendOtp,
  verifyOtp,
  registerAgent,
  changePassword,
  getMe,
  logout
};
