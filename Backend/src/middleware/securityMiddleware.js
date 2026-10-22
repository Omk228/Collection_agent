const jwt = require('jsonwebtoken');

const protectStaticDocs = (req, res, next) => {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1. Block Path Traversal
  const rawUrl = req.url || '';
  if (rawUrl.includes('..') || rawUrl.includes('%2e%2e') || rawUrl.includes('\\')) {
    return res.status(403).json({ success: false, message: 'Forbidden path traversal attempt' });
  }

  // 2. Extract Token from Bearer Header, Query Param (?token=), or Cookie
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.query?.token) {
    token = String(req.query.token).trim();
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  // 3. Verify JWT
  try {
    if (!token) throw new Error('Missing token');
    const secret = process.env.JWT_SECRET || 'fundlelo_loan_collection_agent_jwt_secret_token_2026';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED_DOCUMENT_ACCESS',
      message: 'Access Denied: Authentication token required to access documents.'
    });
  }
};

module.exports = { protectStaticDocs };
