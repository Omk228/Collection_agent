const { query } = require('../config/db');

async function getNotifications(req, res, next) {
  try {
    const agentCode = req.query.agentCode || req.agent?.agent_code || 'AG001';

    const rows = await query(`
      SELECT * FROM agent_notifications 
      WHERE agent_code = ? OR agent_code = 'ALL'
      ORDER BY created_at DESC
      LIMIT 50
    `, [agentCode]);

    return res.json({
      success: true,
      count: rows.length,
      unreadCount: rows.filter(r => !r.is_read).length,
      notifications: rows.map(n => ({
        id: n.id,
        agentCode: n.agent_code,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: Boolean(n.is_read),
        timestamp: n.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
}

async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    await query('UPDATE agent_notifications SET is_read = 1 WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    const agentCode = req.agent?.agent_code || req.body.agentCode || 'AG001';
    await query('UPDATE agent_notifications SET is_read = 1 WHERE agent_code = ? OR agent_code = "ALL"', [agentCode]);
    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
}

async function createNotification(req, res, next) {
  try {
    const { agentCode, title, message, type } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    const result = await query(`
      INSERT INTO agent_notifications (agent_code, title, message, type, is_read)
      VALUES (?, ?, ?, ?, 0)
    `, [agentCode || 'ALL', title, message, type || 'info']);

    return res.status(201).json({
      success: true,
      message: 'Notification sent',
      notificationId: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification
};
