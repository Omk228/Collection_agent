const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');
const { resolveCustomerUserId, saveRepaymentProof } = require('../services/repaymentStorageService');
const { logPanelActivity } = require('../services/panelLogService');

async function recordPayment(req, res, next) {
  try {
    const {
      customerId,
      customerName,
      loanId,
      amount,
      paymentMode,
      transactionReference,
      notes,
      latitude,
      longitude,
      receiptUrl,
      borrowerPhone
    } = req.body;

    if (!customerId && !loanId) {
      return res.status(400).json({ success: false, message: 'Customer ID or Loan ID is required' });
    }
    if (!amount) {
      return res.status(400).json({ success: false, message: 'Payment amount is required' });
    }

    const agentCode = req.agent?.agent_code || req.body.agentCode || 'AG001';
    const agentName = req.agent?.name || req.body.agentName || 'Collection Agent';
    const receiptNumber = req.body.receiptNumber || `RCP${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount' });
    }

    // Lookup borrower info from collection_customers or loan_accounts if missing
    let resolvedCustomerName = customerName;
    let resolvedPhone = borrowerPhone || '';
    let resolvedLoanId = loanId;

    if (customerId) {
      const custRows = await query('SELECT name, phone, loan_id FROM collection_customers WHERE id = ?', [customerId]);
      if (custRows.length > 0) {
        resolvedCustomerName = resolvedCustomerName || custRows[0].name;
        resolvedPhone = resolvedPhone || custRows[0].phone;
        resolvedLoanId = resolvedLoanId || custRows[0].loan_id;
      }
    } else if (loanId) {
      const loanRows = await query('SELECT borrower, phone FROM loan_accounts WHERE id = ? OR application_id = ?', [loanId, loanId]);
      if (loanRows.length > 0) {
        resolvedCustomerName = resolvedCustomerName || loanRows[0].borrower;
        resolvedPhone = resolvedPhone || loanRows[0].phone;
      }
    }

    // 1. Resolve customer's user_id dynamically (e.g. 12)
    const customerUserId = await resolveCustomerUserId({
      customerId,
      loanId: resolvedLoanId,
      borrowerPhone: resolvedPhone
    });

    // 2. Handle Payment Proof screenshot storage in customer_repayments/<userId> outside public_html
    let finalScreenshotUrl = receiptUrl || null;
    let screenshotFilename = req.body.screenshotFilename || null;

    if (finalScreenshotUrl && finalScreenshotUrl.startsWith('/uploads/')) {
      try {
        const localUploadPath = path.join(__dirname, '../../', finalScreenshotUrl);
        if (fs.existsSync(localUploadPath)) {
          const fileBuffer = fs.readFileSync(localUploadPath);
          const saved = saveRepaymentProof({
            customerUserId,
            loanId: resolvedLoanId,
            agentName,
            agentCode,
            fileBuffer,
            originalFilename: screenshotFilename || path.basename(localUploadPath)
          });
          finalScreenshotUrl = saved.url;
          screenshotFilename = saved.filename;
        }
      } catch (err) {
        console.warn('[Storage Notice] move to customer_repayments:', err.message);
      }
    } else if (req.body.screenshotBase64) {
      try {
        let base64Data = req.body.screenshotBase64;
        let ext = 'png';
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mime = matches[1].toLowerCase();
          if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
          else if (mime.includes('pdf')) ext = 'pdf';
          else if (mime.includes('webp')) ext = 'webp';
          base64Data = matches[2];
        }
        const fileBuffer = Buffer.from(base64Data, 'base64');
        const saved = saveRepaymentProof({
          customerUserId,
          loanId: resolvedLoanId,
          agentName,
          agentCode,
          fileBuffer,
          originalFilename: screenshotFilename || `receipt_${Date.now()}.${ext}`
        });
        finalScreenshotUrl = saved.url;
        screenshotFilename = saved.filename;
      } catch (err) {
        console.warn('[Storage Notice] base64 save to customer_repayments:', err.message);
      }
    }

    if (!finalScreenshotUrl) {
      finalScreenshotUrl = `/customer_repayments/${customerUserId}/repay_${String(resolvedLoanId || 'loan').replace(/\W/g, '_')}_${receiptNumber}.png`;
    }

    // 3. Insert into agent_payments
    const insertResult = await query(`
      INSERT INTO agent_payments
      (receipt_number, customer_id, customer_name, loan_id, agent_code, agent_name, amount, payment_mode, transaction_reference, notes, receipt_url, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      receiptNumber,
      customerId || 1,
      resolvedCustomerName || 'Borrower',
      resolvedLoanId || 'LN000',
      agentCode,
      agentName,
      parsedAmount,
      (paymentMode || 'cash').toLowerCase(),
      transactionReference || receiptNumber,
      notes || '',
      finalScreenshotUrl,
      latitude || null,
      longitude || null
    ]);

    // 4. CENTRAL RECONCILIATION: Insert into customer_repayments for Accounts/Finance Panel
    // Saved in customer_repayments/<userId>/ dynamic folder outside public_html
    // Status strictly stays PENDING_ACCOUNTS_VERIFICATION until Accounts panel verifies & closes loan
    try {
      await query(`
        INSERT INTO customer_repayments
        (loan_id, user_id, borrower_name, borrower_phone, amount, payment_mode, utr_number, screenshot_url, screenshot_filename, uploaded_by, uploader_role, status, collector_notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COLLECTION AGENT', 'PENDING_ACCOUNTS_VERIFICATION', ?, NOW(), NOW())
      `, [
        resolvedLoanId || 'LN000',
        isNaN(customerUserId) ? null : parseInt(customerUserId, 10),
        resolvedCustomerName || 'Borrower',
        resolvedPhone || '',
        parsedAmount,
        (paymentMode || 'cash').toUpperCase(),
        transactionReference || receiptNumber,
        finalScreenshotUrl,
        screenshotFilename || path.basename(finalScreenshotUrl),
        agentName,
        notes || `Collected by ${agentName} (${agentCode}) - Pending accounts verification`
      ]);
    } catch (err) {
      console.warn('[Sync Warning] customer_repayments insert:', err.message);
    }

    // 5. UPDATE: Update last_payment on collection_customers (keeps SENT_TO_COLLECTION_AGENT until accounts verification)
    await query(`
      UPDATE collection_customers 
      SET last_payment = CURRENT_DATE(),
          updated_at = NOW()
      WHERE id = ? OR loan_id = ?
    `, [customerId || 0, resolvedLoanId || '']);

    // 6. UPDATE: In loan_accounts, record payment but PRESERVE SENT_TO_COLLECTION_AGENT status
    // Loan will only be marked closed/settled when Accounts panel approves the repayment
    if (resolvedLoanId) {
      try {
        await query(`
          UPDATE loan_accounts
          SET total_paid = total_paid + ?,
              updated_at = NOW()
          WHERE id = ? OR application_id = ?
        `, [parsedAmount, resolvedLoanId, resolvedLoanId]);
      } catch (err) {
        console.warn('[Sync Warning] loan_accounts update:', err.message);
      }
    }

    // 5. CENTRAL UPDATE: Update collections table if case exists
    try {
      await query(`
        UPDATE collections
        SET amount_received = amount_received + ?,
            balance_due = GREATEST(0, balance_due - ?),
            last_payment_date = NOW(),
            payment_method = ?,
            status = CASE WHEN (balance_due - ?) <= 0 THEN 'CLOSED' ELSE status END
        WHERE invoice_no = ? OR collection_id = ? OR customer_name = ?
      `, [parsedAmount, parsedAmount, (paymentMode || 'cash').toUpperCase(), parsedAmount, resolvedLoanId || '', resolvedLoanId || '', resolvedCustomerName || '']);
    } catch (err) {
      console.warn('[Sync Warning] collections table update:', err.message);
    }

    // 6. Record Audit Log
    await query(`
      INSERT INTO agent_audit_logs 
      (agent_code, agent_name, action, entity_type, entity_id, details, latitude, longitude)
      VALUES (?, ?, 'PAYMENT_COLLECTED', 'PAYMENT', ?, ?, ?, ?)
    `, [
      agentCode,
      agentName,
      receiptNumber,
      `Collected ₹${parsedAmount} via ${paymentMode || 'cash'} for ${resolvedCustomerName || 'customer'}`,
      latitude || null,
      longitude || null
    ]).catch(e => console.error(e));

    // 7. Central LMS / CRM panel_logs recording
    await logPanelActivity({
      leadId: customerId || null,
      panelUserId: req.agent?.id || 388,
      agentCode,
      userName: agentName,
      action: 'PAYMENT_COLLECTED',
      remarks: `Collected ₹${parsedAmount} via ${(paymentMode || 'cash').toUpperCase()} for ${resolvedCustomerName || 'Borrower'} (Receipt: ${receiptNumber})`,
      details: {
        receiptNumber,
        amount: parsedAmount,
        paymentMode: (paymentMode || 'cash').toUpperCase(),
        transactionReference,
        loanId: resolvedLoanId,
        customerName: resolvedCustomerName,
        phone: resolvedPhone,
        notes
      },
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.status(201).json({
      success: true,
      message: 'Payment recorded and queued for Accounts verification',
      receiptNumber,
      payment: {
        id: insertResult.insertId,
        receiptNumber,
        customerId,
        customerName: resolvedCustomerName,
        loanId: resolvedLoanId,
        amount: parsedAmount,
        paymentMode: paymentMode || 'cash',
        transactionReference: transactionReference || receiptNumber,
        paymentDate: new Date().toISOString(),
        status: 'success',
        accountsStatus: 'PENDING_ACCOUNTS_VERIFICATION'
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getPayments(req, res, next) {
  try {
    const { agentCode, customerId, date, limit } = req.query;

    let sql = 'SELECT * FROM agent_payments WHERE 1=1';
    const params = [];

    if (agentCode) {
      sql += ' AND agent_code = ?';
      params.push(agentCode);
    }
    if (customerId) {
      sql += ' AND customer_id = ?';
      params.push(customerId);
    }
    if (date) {
      sql += ' AND DATE(payment_date) = ?';
      params.push(date);
    }

    sql += ' ORDER BY payment_date DESC';
    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit, 10));
    }

    const rows = await query(sql, params);

    return res.json({
      success: true,
      count: rows.length,
      payments: rows.map(p => ({
        id: p.id,
        receiptNumber: p.receipt_number,
        customerId: p.customer_id,
        customerName: p.customer_name,
        loanId: p.loan_id,
        agentCode: p.agent_code,
        agentName: p.agent_name,
        amount: parseFloat(p.amount),
        paymentMode: p.payment_mode,
        transactionReference: p.transaction_reference,
        paymentDate: p.payment_date,
        status: p.status,
        notes: p.notes,
        receiptUrl: p.receipt_url
      }))
    });
  } catch (error) {
    next(error);
  }
}

async function getReceiptByNumber(req, res, next) {
  try {
    const { receiptNumber } = req.params;
    const rows = await query('SELECT * FROM agent_payments WHERE receipt_number = ?', [receiptNumber]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    const p = rows[0];
    const amount = parseFloat(p.amount);
    const principalAmount = Math.floor(amount * 0.7);
    const interestAmount = Math.floor(amount * 0.3);

    return res.json({
      success: true,
      receipt: {
        receiptNumber: p.receipt_number,
        paymentDate: p.payment_date,
        customerDetails: {
          name: p.customer_name,
          customerId: `C${String(p.customer_id).padStart(3, '0')}`,
          loanId: p.loan_id
        },
        paymentDetails: {
          totalAmount: amount,
          principalAmount,
          interestAmount,
          paymentMethod: p.payment_mode,
          transactionId: p.transaction_reference,
          collectedBy: p.agent_code,
          agentName: p.agent_name,
          status: p.status
        },
        companyDetails: {
          name: 'Fundlelo Financial Services',
          address: 'A-90 Sector 2 Noida Uttar Pradesh 201301',
          phone: '+91-1800-123-4567',
          email: 'support@fundlelo.com'
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getPaymentSummary(req, res, next) {
  try {
    const agentCode = req.query.agentCode || req.agent?.agent_code;
    const today = new Date().toISOString().split('T')[0];

    const todayStats = await query(`
      SELECT 
        COALESCE(SUM(amount), 0) as totalAmount,
        COUNT(*) as totalTransactions,
        COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN amount ELSE 0 END), 0) as cashAmount,
        COALESCE(SUM(CASE WHEN payment_mode != 'cash' THEN amount ELSE 0 END), 0) as digitalAmount
      FROM agent_payments
      WHERE (? IS NULL OR agent_code = ?) AND DATE(payment_date) = ? AND status = 'success'
    `, [agentCode || null, agentCode || null, today]);

    const totalStats = await query(`
      SELECT 
        COALESCE(SUM(amount), 0) as totalAmount,
        COUNT(*) as totalTransactions
      FROM agent_payments
      WHERE (? IS NULL OR agent_code = ?) AND status = 'success'
    `, [agentCode || null, agentCode || null]);

    return res.json({
      success: true,
      today: {
        totalAmount: parseFloat(todayStats[0].totalAmount) || 0,
        totalTransactions: parseInt(todayStats[0].totalTransactions) || 0,
        cashAmount: parseFloat(todayStats[0].cashAmount) || 0,
        digitalAmount: parseFloat(todayStats[0].digitalAmount) || 0
      },
      overall: {
        totalAmount: parseFloat(totalStats[0].totalAmount) || 0,
        totalTransactions: parseInt(totalStats[0].totalTransactions) || 0
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  recordPayment,
  getPayments,
  getReceiptByNumber,
  getPaymentSummary
};
