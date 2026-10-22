const { query } = require('../config/db');
const { syncAssignedCases } = require('./customerController');

async function getProfile(req, res, next) {
  try {
    const email = req.agent?.email || req.query.email;
    const agentCode = req.agent?.agent_code || req.query.agentCode || 'AG001';

    // 1. Check panel_users first
    if (email) {
      const panelUsers = await query('SELECT * FROM panel_users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
      if (panelUsers.length > 0) {
        const pu = panelUsers[0];
        return res.json({
          success: true,
          agent: {
            id: 'AG001',
            name: pu.name,
            email: pu.email,
            phone: pu.phone || '+919876543210',
            role: pu.role, // 'COLLECTION AGENT'
            territory: 'Delhi NCR',
            experience: '3 years',
            rating: 4.9,
            avatar: null,
            status: pu.status,
            shiftActive: true
          }
        });
      }
    }

    // 2. Check collection_agents
    const agents = await query('SELECT * FROM collection_agents WHERE agent_code = ? OR email = ? LIMIT 1', [agentCode, email || '']);
    if (agents.length === 0) {
      // Fallback to active collection agent in panel_users
      const anyPu = await query('SELECT * FROM panel_users WHERE role = "COLLECTION AGENT" OR role LIKE "%COLL%" LIMIT 1');
      if (anyPu.length > 0) {
        const pu = anyPu[0];
        return res.json({
          success: true,
          agent: {
            id: 'AG001',
            name: pu.name,
            email: pu.email,
            phone: pu.phone,
            role: pu.role,
            territory: 'Delhi NCR',
            experience: '3 years',
            rating: 4.9,
            avatar: null,
            status: pu.status,
            shiftActive: true
          }
        });
      }
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    const agent = agents[0];
    return res.json({
      success: true,
      agent: {
        id: agent.agent_code,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        role: agent.role,
        territory: agent.territory || 'Delhi NCR',
        experience: agent.experience || '3 years',
        rating: parseFloat(agent.rating) || 4.9,
        avatar: agent.avatar,
        status: agent.status,
        shiftActive: Boolean(agent.shift_active)
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const email = req.agent?.email || req.body.email;
    const agentCode = req.agent?.agent_code || req.body.agentCode || 'AG001';
    const { name, phone, territory, shiftActive } = req.body;

    if (email) {
      const updates = [];
      const params = [];
      if (name !== undefined) { updates.push('name = ?'); params.push(name); }
      if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
      if (updates.length > 0) {
        params.push(email);
        await query(`UPDATE panel_users SET ${updates.join(', ')} WHERE email = ?`, params);
      }
    }

    const agentUpdates = [];
    const agentParams = [];
    if (name !== undefined) { agentUpdates.push('name = ?'); agentParams.push(name); }
    if (phone !== undefined) { agentUpdates.push('phone = ?'); agentParams.push(phone); }
    if (territory !== undefined) { agentUpdates.push('territory = ?'); agentParams.push(territory); }
    if (shiftActive !== undefined) { agentUpdates.push('shift_active = ?'); agentParams.push(shiftActive ? 1 : 0); }

    if (agentUpdates.length > 0) {
      agentParams.push(agentCode);
      await query(`UPDATE collection_agents SET ${agentUpdates.join(', ')} WHERE agent_code = ?`, agentParams);
    }

    return res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
}

async function getDashboardStats(req, res, next) {
  try {
    const email = req.agent?.email || req.query.email;
    const agentCode = req.agent?.agent_code || req.query.agentCode || 'AG001';

    // 1. Sync strictly assigned cases first
    if (syncAssignedCases) {
      await syncAssignedCases(agentCode);
    }

    // 2. Fetch real agent profile dynamically for this agentCode
    let agentName = 'Collection Agent';
    let agentRole = 'COLLECTION AGENT';
    let agentEmail = email || 'collectionagent@fundlelo.site';
    let agentPhone = '+919876543210';

    if (email) {
      const puRows = await query('SELECT * FROM panel_users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
      if (puRows.length > 0) {
        agentName = puRows[0].name;
        agentRole = puRows[0].role;
        agentEmail = puRows[0].email;
        agentPhone = puRows[0].phone || agentPhone;
      }
    } else {
      const caRows = await query('SELECT * FROM collection_agents WHERE agent_code = ? LIMIT 1', [agentCode]);
      if (caRows.length > 0) {
        agentName = caRows[0].name;
        agentRole = caRows[0].role;
        agentEmail = caRows[0].email || agentEmail;
        agentPhone = caRows[0].phone || agentPhone;
      }
    }

    // 3. Dynamic Targets strictly calculated from the cases assigned to this agent
    const assignedRows = await query(`
      SELECT 
        COUNT(*) as totalAssigned,
        COALESCE(SUM(amount_due), 0) as totalDue,
        COALESCE(SUM(emi_amount), 0) as totalEmi,
        COUNT(CASE WHEN status = 'overdue' OR days_past_due > 0 THEN 1 END) as overdueCount
      FROM collection_customers 
      WHERE assigned_agent_code = ?
    `, [agentCode]);

    const totalAssignedCases = parseInt(assignedRows[0]?.totalAssigned, 10) || 0;
    const totalTargetCollections = Math.round(parseFloat(assignedRows[0]?.totalDue) || parseFloat(assignedRows[0]?.totalEmi) || 0);

    const targetCollections = totalTargetCollections;
    const targetCalls = totalAssignedCases;
    const targetVisits = totalAssignedCases;
    const targetPayments = totalAssignedCases;

    // Sync targets into collection_agents table
    await query(`
      UPDATE collection_agents 
      SET target_collections = ?, target_calls = ?, target_visits = ?, target_payments = ? 
      WHERE agent_code = ?
    `, [targetCollections, targetCalls, targetVisits, targetPayments, agentCode]);

    // 4. Real Today's Achieved Collections for this specific agent from database
    const today = new Date().toISOString().split('T')[0];
    const paymentsToday = await query(`
      SELECT COALESCE(SUM(amount), 0) as totalCollected, COUNT(*) as count 
      FROM agent_payments 
      WHERE (agent_code = ? OR agent_name = ?) AND DATE(payment_date) = ? AND status = 'success'
    `, [agentCode, agentName, today]);

    // 5. Real Today's Visits for this specific agent from database
    const visitsToday = await query(`
      SELECT COUNT(*) as count 
      FROM agent_visits 
      WHERE (agent_code = ? OR agent_name = ?) AND DATE(created_at) = ?
    `, [agentCode, agentName, today]);

    // 6. Real Weekly Data for this agent from database
    const weeklyData = await query(`
      SELECT COALESCE(SUM(amount), 0) as totalWeekly, COUNT(*) as count 
      FROM agent_payments 
      WHERE (agent_code = ? OR agent_name = ?) AND payment_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND status = 'success'
    `, [agentCode, agentName]);

    // 7. Total Agents in system
    const totalStaff = await query('SELECT COUNT(*) as cnt FROM panel_users WHERE role = "COLLECTION AGENT" OR role LIKE "%COLL%"');
    const totalAgentsCount = Math.max(1, totalStaff[0].cnt);

    const achievedCollections = parseFloat(paymentsToday[0].totalCollected) || 0;
    const collectionsPct = targetCollections > 0 ? Math.min(Math.round((achievedCollections / targetCollections) * 100), 100) : 0;

    const achievedVisits = parseInt(visitsToday[0].count, 10) || 0;
    const visitsPct = targetVisits > 0 ? Math.min(Math.round((achievedVisits / targetVisits) * 100), 100) : 0;

    const achievedPayments = parseInt(paymentsToday[0].count, 10) || 0;
    const paymentsPct = targetPayments > 0 ? Math.min(Math.round((achievedPayments / targetPayments) * 100), 100) : 0;

    // Call count from real audit logs / interactions for this agent
    const callsLog = await query(`
      SELECT COUNT(*) as cnt FROM agent_audit_logs 
      WHERE (agent_code = ? OR agent_name = ?) AND action LIKE '%CALL%' AND DATE(created_at) = ?
    `, [agentCode, agentName, today]);
    const achievedCalls = parseInt(callsLog[0].cnt, 10) || 0;
    const callsPct = targetCalls > 0 ? Math.min(Math.round((achievedCalls / targetCalls) * 100), 100) : 0;

    // 8. Real Attendance status for today
    const attRows = await query(`
      SELECT * FROM agent_attendance 
      WHERE agent_code = ? AND date = ? 
      ORDER BY id DESC LIMIT 1
    `, [agentCode, today]);

    let attendance = {
      shiftActive: false,
      punchInTime: null,
      punchOutTime: null,
      status: 'NOT_STARTED',
      address: null
    };

    if (attRows.length > 0) {
      const att = attRows[0];
      const isShiftActive = att.status === 'PRESENT' && !att.punch_out_time;
      let punchInFormatted = '';
      if (att.punch_in_time) {
        const d = new Date(att.punch_in_time);
        punchInFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      }
      attendance = {
        shiftActive: isShiftActive,
        punchInTime: punchInFormatted,
        punchOutTime: att.punch_out_time,
        status: att.status,
        address: att.punch_in_address
      };
    }

    // 9. Real Schedule/Tasks for today from agent_tasks
    let tasks = await query(`
      SELECT id, title as task, due_time as time, location, task_type as type, status, customer_name as customerName 
      FROM agent_tasks 
      WHERE (agent_code = ? OR agent_code = 'AG001') AND (due_date = ? OR status = 'pending')
      ORDER BY due_time ASC
      LIMIT 8
    `, [agentCode, today]);

    // 10. Real Recent Activity from database for this agent
    const recentActivity = await query(`
      (SELECT 'payment' as type, CONCAT('Collected ₹', FORMAT(amount, 0), ' from ', customer_name) as description, created_at as timestamp 
       FROM agent_payments WHERE agent_code = ? OR agent_name = ? ORDER BY created_at DESC LIMIT 5)
      UNION ALL
      (SELECT 'visit' as type, CONCAT('Visited ', customer_name, ' (', outcome, ')') as description, created_at as timestamp 
       FROM agent_visits WHERE agent_code = ? OR agent_name = ? ORDER BY created_at DESC LIMIT 5)
      ORDER BY timestamp DESC LIMIT 6
    `, [agentCode, agentName, agentCode, agentName]);

    return res.json({
      success: true,
      agentProfile: {
        id: agentCode,
        agentCode: agentCode,
        name: agentName,
        email: agentEmail,
        phone: agentPhone,
        role: agentRole,
        territory: 'Delhi NCR',
        experience: '3 years',
        rating: 4.9,
        avatar: null
      },
      attendance,
      totalOutstanding: targetCollections,
      assignedCasesCount: totalAssignedCases,
      todayTargets: {
        collections: { target: targetCollections, achieved: achievedCollections, percentage: collectionsPct },
        calls: { target: targetCalls, achieved: achievedCalls, percentage: callsPct },
        visits: { target: targetVisits, achieved: achievedVisits, percentage: visitsPct },
        newPayments: { target: targetPayments, achieved: achievedPayments, percentage: paymentsPct }
      },
      weeklyStats: {
        totalCollected: parseFloat(weeklyData[0].totalWeekly) || 0,
        averageDaily: Math.round((parseFloat(weeklyData[0].totalWeekly) || 0) / 7),
        bestDay: parseFloat(weeklyData[0].totalWeekly) || 0,
        successRate: achievedPayments > 0 ? 100 : 0,
        rank: 1,
        totalAgents: totalAgentsCount
      },
      todaySchedule: tasks,
      recentActivity
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getDashboardStats
};
