const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const upload = require('../middleware/upload');
const { resolveCustomerUserId, saveRepaymentProof } = require('../services/repaymentStorageService');
const { logPanelActivity } = require('../services/panelLogService');

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  try {
    const { customerId, loanId, userId, borrowerPhone } = req.body;
    const agentName = req.agent?.name || req.body.agentName || 'Collection Agent';
    const agentCode = req.agent?.agent_code || req.body.agentCode || 'AG001';

    // 1. Resolve customer's user_id dynamically
    const customerUserId = await resolveCustomerUserId({
      customerId: customerId || userId,
      loanId,
      borrowerPhone
    });

    // 2. Read the uploaded file buffer from temporary upload path
    const fileBuffer = fs.readFileSync(req.file.path);

    // 3. Save into customer_repayments/<userId>/ dynamic folder outside public_html
    const saved = saveRepaymentProof({
      customerUserId,
      loanId: loanId || 'loan',
      agentName,
      agentCode,
      fileBuffer,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype
    });

    // Clean up temporary file from uploads/
    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (_) {}

    // Central LMS / CRM panel_logs recording
    await logPanelActivity({
      leadId: customerId && !isNaN(parseInt(customerId, 10)) ? parseInt(customerId, 10) : null,
      panelUserId: req.agent?.id || 388,
      agentCode,
      userName: agentName,
      action: 'PAYMENT_PROOF_UPLOADED',
      remarks: `Payment proof uploaded for customer ID ${customerId || customerUserId} (${loanId || 'N/A'}) - ${req.file.originalname}`,
      details: {
        filename: saved.filename,
        originalFilename: req.file.originalname,
        url: saved.url,
        userId: customerUserId,
        size: req.file.size,
        mimeType: req.file.mimetype
      },
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({
      success: true,
      message: `Payment proof saved in customer_repayments/${customerUserId} folder outside public_html`,
      filename: saved.filename,
      originalFilename: req.file.originalname,
      url: saved.url,
      userId: customerUserId,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('[Upload Error] saving repayment proof:', error);
    // Fallback to default uploads url
    return res.json({
      success: true,
      message: 'File uploaded',
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  }
});

module.exports = router;
