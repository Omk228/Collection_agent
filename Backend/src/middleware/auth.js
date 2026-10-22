const jwt = require('jsonwebtoken');

function authenticateAgent(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // If no token, allow agentCode header for simple mock/direct requests, or reject
    const fallbackAgentCode = req.headers['x-agent-code'];
    if (fallbackAgentCode) {
      req.agent = { agent_code: fallbackAgentCode, name: 'Agent ' + fallbackAgentCode };
      return next();
    }
    return res.status(401).json({ success: false, message: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fundlelo_loan_collection_agent_jwt_secret_token_2026');
    req.agent = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token', error: err.message });
  }
}

// Optional auth - doesn't fail if token missing
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fundlelo_loan_collection_agent_jwt_secret_token_2026');
      req.agent = decoded;
    } catch (e) {
      // ignore
    }
  } else if (req.headers['x-agent-code']) {
    req.agent = { agent_code: req.headers['x-agent-code'] };
  }
  next();
}

module.exports = {
  authenticateAgent,
  optionalAuth
};
