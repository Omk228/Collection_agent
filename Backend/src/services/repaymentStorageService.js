const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');

/**
 * Resolves the customer_repayments folder outside public_html.
 * In cPanel environment: /home/fundlelo/customer_repayments (outside public_html)
 * In local environment: C:/Users/Om Kumar Jha/Desktop/Fund_lelo/customer_repayments
 */
function getCustomerRepaymentsBaseDir() {
  if (process.env.CUSTOMER_REPAYMENTS_PATH && fs.existsSync(process.env.CUSTOMER_REPAYMENTS_PATH)) {
    return process.env.CUSTOMER_REPAYMENTS_PATH;
  }

  const candidates = [
    // 1. Shared Desktop Fund_lelo customer_repayments folder (outside public_html)
    'C:/Users/Om Kumar Jha/Desktop/Fund_lelo/customer_repayments',
    // 2. cPanel server environment: /home/fundlelo/customer_repayments (outside public_html)
    '/home/fundlelo/customer_repayments',
    // 3. Relative fallbacks outside public_html
    path.resolve(__dirname, '../../../../customer_repayments'),
    path.resolve(__dirname, '../../../customer_repayments'),
    path.resolve(__dirname, '../../customer_repayments'),
    path.resolve(process.cwd(), '../customer_repayments'),
    path.resolve(process.cwd(), 'customer_repayments'),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  // Create primary directory outside public_html
  const primaryDir = 'C:/Users/Om Kumar Jha/Desktop/Fund_lelo/customer_repayments';
  try {
    if (!fs.existsSync(primaryDir)) {
      fs.mkdirSync(primaryDir, { recursive: true });
    }
    return primaryDir;
  } catch (e) {
    const localDir = path.resolve(process.cwd(), 'customer_repayments');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return localDir;
  }
}

/**
 * Dynamically resolves the customer's user_id from leads, users, loan_accounts, or collection_customers.
 */
async function resolveCustomerUserId({ customerId, loanId, borrowerPhone, userId }) {
  // If customer userId is passed directly, use it immediately
  if (userId && String(userId).trim() !== '' && String(userId).trim() !== 'undefined') {
    return String(userId).trim();
  }

  let customerUserId = null;
  let dbReachable = true;

  // Helper with short timeout for network resilience
  const safeQuery = async (sql, params) => {
    if (!dbReachable) return [];
    try {
      const queryPromise = query(sql, params);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('QUERY_TIMEOUT')), 2500));
      return await Promise.race([queryPromise, timeoutPromise]);
    } catch (err) {
      if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.message === 'QUERY_TIMEOUT') {
        dbReachable = false; // Don't block on further network timeouts
      }
      return [];
    }
  };

  // 1. Check leads table for user_id
  if (loanId && dbReachable) {
    const cleanLoan = String(loanId).trim();
    const cleanNoPrefix = cleanLoan.replace(/^LN-/i, '');
    const leadRows = await safeQuery(
      `SELECT user_id FROM leads 
       WHERE loan_id = ? 
          OR CONCAT('LN-', lead_number) = ? 
          OR lead_number = ? 
          OR lead_number = ? 
          OR (mobile = ? AND mobile != '') 
       LIMIT 1`,
      [cleanLoan, cleanLoan, cleanLoan, cleanNoPrefix, borrowerPhone || '']
    );

    if (leadRows.length > 0 && leadRows[0].user_id) {
      customerUserId = leadRows[0].user_id;
    }
  }

  // 2. Check loan_accounts application_id link to leads
  if (!customerUserId && loanId && dbReachable) {
    const loanRows = await safeQuery(
      'SELECT application_id, phone FROM loan_accounts WHERE id = ? OR application_id = ? LIMIT 1',
      [loanId, loanId]
    );

    if (loanRows.length > 0) {
      const appId = loanRows[0].application_id;
      if (appId) {
        const leadApp = await safeQuery('SELECT user_id FROM leads WHERE id = ? OR lead_number = ? LIMIT 1', [appId, appId]);
        if (leadApp.length > 0 && leadApp[0].user_id) {
          customerUserId = leadApp[0].user_id;
        }
      }
      if (!borrowerPhone && loanRows[0].phone) {
        borrowerPhone = loanRows[0].phone;
      }
    }
  }

  // 3. Check users table by phone number
  if (!customerUserId && borrowerPhone && dbReachable) {
    const cleanPhone = String(borrowerPhone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length >= 10) {
      const userRows = await safeQuery(
        `SELECT id FROM users WHERE phone LIKE ? OR mobile_number LIKE ? LIMIT 1`,
        [`%${cleanPhone}%`, `%${cleanPhone}%`]
      );

      if (userRows.length > 0 && userRows[0].id) {
        customerUserId = userRows[0].id;
      }
    }
  }

  // 4. Check collection_customers record
  if (!customerUserId && customerId && dbReachable) {
    const custRows = await safeQuery('SELECT id, loan_id, phone FROM collection_customers WHERE id = ?', [customerId]);
    if (custRows.length > 0) {
      customerUserId = custRows[0].id;
    }
  }

  // 5. Fallback: clean identifier
  if (!customerUserId) {
    customerUserId = customerId ? String(customerId) : (loanId ? String(loanId).replace(/\W/g, '_') : '12');
  }

  return String(customerUserId).trim();
}

/**
 * Saves payment proof into customer_repayments/<userId>/ dynamically created folder.
 * Uses current logged in user (agent) in the filename and audit tracking.
 */
function saveRepaymentProof({
  customerUserId,
  loanId,
  agentName,
  agentCode,
  fileBuffer,
  originalFilename,
  mimeType
}) {
  const baseDir = getCustomerRepaymentsBaseDir();
  const folderName = String(customerUserId).trim();
  const customerDir = path.join(baseDir, folderName);

  // 1. Ensure dynamic folder for this customer exists: customer_repayments/<userId>
  if (!fs.existsSync(customerDir)) {
    fs.mkdirSync(customerDir, { recursive: true });
  }

  // Determine file extension
  let ext = 'png';
  if (originalFilename && originalFilename.includes('.')) {
    ext = originalFilename.split('.').pop().toLowerCase();
  } else if (mimeType) {
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (mimeType.includes('pdf')) ext = 'pdf';
    else if (mimeType.includes('webp')) ext = 'webp';
  }

  const safeUploader = String(agentName || agentCode || 'Agent').replace(/\W/g, '_');
  const safeLoan = String(loanId || 'loan').replace(/\W/g, '_');
  const safeFilename = `repay_${safeLoan}_${safeUploader}_${Date.now()}.${ext}`;
  const targetFilePath = path.join(customerDir, safeFilename);

  // Write file to customer's dynamic folder
  fs.writeFileSync(targetFilePath, fileBuffer);

  // Also write to local Collection_agent fallback folder for static serving
  const localCustomerDir = path.resolve(process.cwd(), 'customer_repayments', folderName);
  try {
    if (!fs.existsSync(localCustomerDir)) {
      fs.mkdirSync(localCustomerDir, { recursive: true });
    }
    fs.writeFileSync(path.join(localCustomerDir, safeFilename), fileBuffer);
  } catch (_) {}

  const url = `/customer_repayments/${folderName}/${safeFilename}`;

  return {
    filePath: targetFilePath,
    filename: safeFilename,
    originalFilename: originalFilename || safeFilename,
    url,
    customerUserId: folderName
  };
}

module.exports = {
  getCustomerRepaymentsBaseDir,
  resolveCustomerUserId,
  saveRepaymentProof
};
