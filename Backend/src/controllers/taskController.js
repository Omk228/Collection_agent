const { query } = require('../config/db');
const { logPanelActivity } = require('../services/panelLogService');

async function getTasks(req, res, next) {
  try {
    const agentCode = req.query.agentCode || req.agent?.agent_code || 'AG001';
    const status = req.query.status;

    let sql = 'SELECT * FROM agent_tasks WHERE agent_code = ?';
    const params = [agentCode];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY due_date ASC, due_time ASC';

    const rows = await query(sql, params);

    return res.json({
      success: true,
      count: rows.length,
      tasks: rows.map(t => ({
        id: t.id,
        agentCode: t.agent_code,
        customerId: t.customer_id,
        customerName: t.customer_name,
        title: t.title,
        description: t.description,
        taskType: t.task_type,
        dueDate: t.due_date,
        dueTime: t.due_time,
        location: t.location,
        priority: t.priority,
        status: t.status,
        createdAt: t.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
}

async function createTask(req, res, next) {
  try {
    const {
      customerId,
      customerName,
      title,
      description,
      taskType,
      dueDate,
      dueTime,
      location,
      priority
    } = req.body;

    const agentCode = req.agent?.agent_code || req.body.agentCode || 'AG001';

    if (!title || !dueDate) {
      return res.status(400).json({ success: false, message: 'Title and due date are required' });
    }

    const result = await query(`
      INSERT INTO agent_tasks
      (agent_code, customer_id, customer_name, title, description, task_type, due_date, due_time, location, priority, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [
      agentCode,
      customerId || null,
      customerName || null,
      title,
      description || '',
      taskType || 'visit',
      dueDate,
      dueTime || '10:00 AM',
      location || 'On Field',
      priority || 'medium'
    ]);

    // Log in panel_logs
    await logPanelActivity({
      leadId: customerId || null,
      panelUserId: req.agent?.id || 388,
      agentCode,
      userName: req.agent?.name || 'Collection Agent',
      action: 'TASK_CREATED',
      newStatus: 'pending',
      remarks: `Created task: "${title}" for ${customerName || 'customer'} due on ${dueDate}`,
      details: {
        title,
        taskType: taskType || 'visit',
        dueDate,
        dueTime,
        priority: priority || 'medium',
        location: location || 'On Field'
      },
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.status(201).json({
      success: true,
      message: 'Task created successfully',
      taskId: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

async function updateTask(req, res, next) {
  try {
    const { id } = req.params;
    const { status, dueDate, dueTime, priority, notes } = req.body;
    const agentCode = req.agent?.agent_code || req.body.agentCode || 'AG001';

    const updates = [];
    const params = [];

    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (dueDate !== undefined) { updates.push('due_date = ?'); params.push(dueDate); }
    if (dueTime !== undefined) { updates.push('due_time = ?'); params.push(dueTime); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (notes !== undefined) { updates.push('description = ?'); params.push(notes); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    params.push(id);
    await query(`UPDATE agent_tasks SET ${updates.join(', ')} WHERE id = ?`, params);

    // Log in panel_logs
    await logPanelActivity({
      panelUserId: req.agent?.id || 388,
      agentCode,
      userName: req.agent?.name || 'Collection Agent',
      action: status === 'completed' ? 'TASK_COMPLETED' : 'TASK_UPDATED',
      newStatus: status || null,
      remarks: `Task #${id} updated: status=${status || 'unchanged'}`,
      details: { taskId: id, status, dueDate, dueTime, priority, notes },
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({ success: true, message: 'Task updated successfully' });
  } catch (error) {
    next(error);
  }
}

async function deleteTask(req, res, next) {
  try {
    const { id } = req.params;
    await query('DELETE FROM agent_tasks WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTasks,
  createTask,
  updateTask,
  deleteTask
};
