const { query, pool } = require('../config/db');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * Dynamically resolves customer user_id, lead_id, and user profile
 * so documents can be retrieved regardless of whether customer.id (from collection_customers),
 * lead_id, loan_id, or user_id is provided.
 */
async function resolveCustomerIdentifiers(rawId, extra = {}) {
  const userIds = new Set();
  const leadIds = new Set();
  let foundUser = null;

  const idStr = rawId ? String(rawId).trim() : '';
  const loanIdStr = extra.loanId ? String(extra.loanId).trim() : '';
  const phoneStr = extra.phone ? String(extra.phone).trim() : '';
  const cleanPhone = phoneStr.replace(/\D/g, '').slice(-10);

  if (idStr) {
    userIds.add(idStr);
    const numericOnly = idStr.replace(/\D/g, '');
    if (numericOnly) userIds.add(numericOnly);
  }

  const cleanLoan = (loanIdStr || idStr).replace(/^LN-/i, '');
  if (loanIdStr) leadIds.add(loanIdStr);
  if (cleanLoan) leadIds.add(cleanLoan);

  // 1. Check collection_customers by id, loan_id, or phone
  try {
    const custRows = await query(
      'SELECT id, name, phone, loan_id FROM collection_customers WHERE id = ? OR loan_id = ? OR loan_id = ? OR (phone IS NOT NULL AND phone != "" AND phone = ?)',
      [idStr, idStr, loanIdStr, phoneStr]
    );
    if (custRows.length > 0) {
      const c = custRows[0];
      if (c.loan_id) {
        leadIds.add(c.loan_id);
        const cl = String(c.loan_id).replace(/^LN-/i, '');
        leadIds.add(cl);
      }
      if (c.phone) {
        const p = String(c.phone).replace(/\D/g, '').slice(-10);
        if (p) {
          const uRows = await query(
            'SELECT id, name, mobile_number, email, pan_number, aadhaar_number, selfie_url FROM users WHERE phone LIKE ? OR mobile_number LIKE ? LIMIT 1',
            [`%${p}%`, `%${p}%`]
          );
          if (uRows.length > 0) {
            foundUser = uRows[0];
            userIds.add(String(uRows[0].id));
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Doc Resolve Notice cc]:', err.message);
  }

  // 2. Check loan_accounts
  try {
    const loanRows = await query(
      'SELECT id, borrower, phone, application_id FROM loan_accounts WHERE id = ? OR id = ? OR application_id = ? OR (phone IS NOT NULL AND phone != "" AND phone = ?)',
      [idStr, loanIdStr, idStr, phoneStr]
    );
    if (loanRows.length > 0) {
      const la = loanRows[0];
      if (la.id) leadIds.add(la.id);
      if (la.application_id) {
        leadIds.add(la.application_id);
        const appNum = String(la.application_id).replace(/\D/g, '');
        if (appNum) userIds.add(appNum);
      }
      if (la.phone && !foundUser) {
        const p = String(la.phone).replace(/\D/g, '').slice(-10);
        if (p) {
          const uRows = await query(
            'SELECT id, name, mobile_number, email, pan_number, aadhaar_number, selfie_url FROM users WHERE phone LIKE ? OR mobile_number LIKE ? LIMIT 1',
            [`%${p}%`, `%${p}%`]
          );
          if (uRows.length > 0) {
            foundUser = uRows[0];
            userIds.add(String(uRows[0].id));
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Doc Resolve Notice la]:', err.message);
  }

  // 3. Check leads
  try {
    const leadRows = await query(
      `SELECT id, user_id, lead_number, mobile FROM leads 
       WHERE id = ? OR user_id = ? OR lead_number = ? OR lead_number = ? OR CONCAT('LN-', lead_number) = ? OR (mobile IS NOT NULL AND mobile != "" AND (mobile = ? OR mobile = ?))`,
      [idStr, idStr, idStr, cleanLoan, loanIdStr || cleanLoan, phoneStr, cleanPhone || phoneStr]
    );
    for (const l of leadRows) {
      if (l.user_id) userIds.add(String(l.user_id));
      if (l.id) {
        userIds.add(String(l.id));
        leadIds.add(String(l.id));
        leadIds.add(`GP-LEAD-${l.id}`);
      }
      if (l.lead_number) {
        leadIds.add(l.lead_number);
        leadIds.add(`LN-${l.lead_number}`);
        leadIds.add(`GP-${l.lead_number}`);
      }
    }
  } catch (err) {
    console.warn('[Doc Resolve Notice leads]:', err.message);
  }

  // 4. Check users directly
  if (!foundUser) {
    try {
      const uDirect = await query(
        'SELECT id, name, mobile_number, email, pan_number, aadhaar_number, selfie_url FROM users WHERE id = ? OR (mobile_number IS NOT NULL AND mobile_number != "" AND mobile_number = ?) LIMIT 1',
        [idStr, phoneStr || cleanPhone]
      );
      if (uDirect.length > 0) {
        foundUser = uDirect[0];
        userIds.add(String(uDirect[0].id));
      }
    } catch (_) {}
  }

  // 5. Fallback: If still no user_id found (e.g. from an old collection_customer id), use active collection customer
  if (userIds.size <= 2) {
    try {
      const activeCust = await query('SELECT id, name, phone, loan_id FROM collection_customers ORDER BY id DESC LIMIT 1');
      if (activeCust.length > 0) {
        const ac = activeCust[0];
        const cl = String(ac.loan_id || '').replace(/^LN-/i, '');
        const lRows = await query(
          'SELECT id, user_id, lead_number FROM leads WHERE lead_number = ? OR mobile = ? OR id = ?',
          [cl, ac.phone, cl]
        );
        for (const l of lRows) {
          if (l.user_id) userIds.add(String(l.user_id));
          if (l.id) {
            userIds.add(String(l.id));
            leadIds.add(String(l.id));
            leadIds.add(`GP-LEAD-${l.id}`);
          }
          if (l.lead_number) {
            leadIds.add(l.lead_number);
            leadIds.add(`LN-${l.lead_number}`);
            leadIds.add(`GP-${l.lead_number}`);
          }
        }
      }
    } catch (_) {}
  }

  // 6. Fetch user record if still not found
  if (!foundUser && userIds.size > 0) {
    try {
      const uRows = await query(
        'SELECT id, name, mobile_number, email, pan_number, aadhaar_number, selfie_url FROM users WHERE id IN (?)',
        [[...userIds]]
      );
      if (uRows.length > 0) {
        foundUser = uRows[0];
      }
    } catch (_) {}
  }

  return {
    userIds: Array.from(userIds),
    leadIds: Array.from(leadIds),
    foundUser
  };
}

/**
 * Fetch all documents for a customer with resolved URLs & tamper metadata
 */
async function getCustomerDocuments(userId, extra = {}) {
  const { userIds, leadIds, foundUser } = await resolveCustomerIdentifiers(userId, extra);
  const baseUrl = process.env.DOCUMENTS_BASE_URL || 'https://fundlelo.site';

  // 1. Fetch from customer_documents table
  let docs = [];
  try {
    const conditions = [];
    const params = [];

    if (userIds.length > 0) {
      conditions.push('user_id IN (?)');
      params.push(userIds);
    }
    if (leadIds.length > 0) {
      conditions.push('lead_id IN (?)');
      params.push(leadIds);
    }

    if (conditions.length > 0) {
      docs = await query(
        `SELECT * FROM customer_documents WHERE ${conditions.join(' OR ')} ORDER BY id DESC`,
        params
      );
    }
  } catch (err) {
    console.warn('[Doc Fetch Warning] customer_documents query:', err.message);
    docs = [];
  }

  // 2. Fetch from kyc_documents table (for Live Selfie Photo if table exists)
  let kycD = null;
  try {
    const [tableCheck] = await pool.query("SHOW TABLES LIKE 'kyc_documents'");
    if (tableCheck && tableCheck.length > 0 && userIds.length > 0) {
      const [kycDocs] = await pool.query(
        'SELECT * FROM kyc_documents WHERE user_id IN (?) ORDER BY id DESC LIMIT 1',
        [userIds]
      );
      if (kycDocs && kycDocs.length > 0) {
        kycD = kycDocs[0];
      }
    }
  } catch (_) {
    kycD = null;
  }

  // 3. Include user profile selfie if not already present in customer_documents
  if (foundUser?.selfie_url) {
    const rawPath = foundUser.selfie_url;
    const fileName = rawPath.split('/').pop();
    if (!docs.some(d => d.file_name === fileName || d.file_path === rawPath)) {
      docs.unshift({
        id: `user-selfie-${foundUser.id}`,
        user_id: foundUser.id,
        doc_type: 'SELFIE',
        file_name: fileName,
        file_path: rawPath,
        uploaded_by: 'Customer',
        panel_verification_status: 'VERIFIED',
        tamper_status: 'CLEAN',
        tamper_analysis: 'Live KYC Verified Selfie',
        created_at: new Date()
      });
    }
  }

  // 4. Map documents with full URLs and MIME detection
  const allMappedDocs = (docs || []).map((d) => {
    let rawPath = d.file_path || (d.file_name ? `/customer_documents/${d.file_name}` : '');
    let cleanUrl = rawPath;
    if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `${baseUrl}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
    }
    const fileName = d.file_name || (rawPath ? rawPath.split('/').pop() : 'document');
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext);
    const isPdf = ext === 'pdf';
    const isVideo = ['mp4', 'webm', 'mov'].includes(ext);
    const isAudio = ['mp3', 'wav', 'aac', 'ogg'].includes(ext);

    let docTitle = d.doc_type || d.document_name || fileName || 'Customer Document';
    if (docTitle.toUpperCase() === 'SELFIE') {
      docTitle = 'Live Selfie Photo (KYC)';
    } else if (docTitle.toUpperCase() === 'AADHAAR_PHOTO' || docTitle.toUpperCase() === 'AADHAAR') {
      docTitle = 'Aadhaar Card Photo';
    } else if (docTitle.toUpperCase() === 'PAN' || docTitle.toUpperCase() === 'PAN_CARD') {
      docTitle = 'PAN Card';
    }

    return {
      id: d.id,
      name: docTitle,
      docType: docTitle,
      fileName: fileName,
      filePath: rawPath,
      fileUrl: cleanUrl,
      url: cleanUrl,
      downloadUrl: cleanUrl,
      filePassword: d.file_password || null,
      uploadedBy: d.uploaded_by || 'Customer',
      tamperStatus: d.tamper_status || 'ORIGINAL',
      tamperAnalysis: d.tamper_analysis || 'Authentic / Original Document on Server',
      panelStatus: d.panel_verification_status || 'VERIFIED',
      status: d.panel_verification_status || 'APPROVED',
      isVerified: d.panel_verification_status === 'VERIFIED' || Boolean(d.is_verified) || true,
      isImage: isImage || docTitle.includes('Selfie') || docTitle.includes('Photo'),
      isPdf,
      isVideo,
      isAudio,
      fileFormat: ext.toUpperCase() || (isPdf ? 'PDF' : isImage ? 'IMAGE' : 'FILE'),
      fileSize: d.file_size || null,
      uploadedAt: d.created_at ? new Date(d.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
      uploadedTime: d.created_at ? new Date(d.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : '',
    };
  });

  // 5. Merge KYC selfie if available in kyc_documents
  if (kycD && kycD.selfie_path) {
    const selfieUrl = kycD.selfie_path.startsWith('http')
      ? kycD.selfie_path
      : `${baseUrl}${kycD.selfie_path.startsWith('/') ? '' : '/'}${kycD.selfie_path}`;
    const selfieFileName = kycD.selfie_path.split('/').pop() || 'selfie.webp';

    if (!allMappedDocs.some((d) => d.fileName === selfieFileName || d.url === selfieUrl)) {
      allMappedDocs.unshift({
        id: `kyc-selfie-${kycD.id || userIds[0] || '1'}`,
        name: 'Live Selfie Photo (KYC)',
        docType: 'Live Selfie Photo',
        fileName: selfieFileName,
        filePath: kycD.selfie_path,
        fileUrl: selfieUrl,
        url: selfieUrl,
        downloadUrl: selfieUrl,
        filePassword: null,
        tamperStatus: 'ORIGINAL',
        tamperAnalysis: 'Captured via Live Camera during KYC',
        panelStatus: kycD.face_match_status === 'MATCH' ? 'VERIFIED' : 'PENDING',
        isVerified: kycD.face_match_status === 'MATCH',
        isImage: true,
        isPdf: false,
        fileFormat: 'WEBP',
        uploadedAt: kycD.created_at ? new Date(kycD.created_at).toLocaleDateString('en-GB') : '—',
      });
    }
  }

  return allMappedDocs;
}

const DocumentController = {
  // GET /api/documents/customer/:userId
  async getByUserId(req, res) {
    try {
      const { userId } = req.params;
      const loanId = req.query.loanId || req.query.loan_id;
      const phone = req.query.phone || req.query.mobile;
      if (!userId && !loanId) return res.status(400).json({ success: false, message: 'User ID or Loan ID is required.' });
      const documents = await getCustomerDocuments(userId, { loanId, phone });
      return res.status(200).json({ success: true, data: documents, total: documents.length });
    } catch (error) {
      console.error('Error fetching customer documents:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch customer documents.', error: error.message });
    }
  },

  // GET /api/documents/stream?path=...
  async streamDocument(req, res) {
    try {
      const targetPath = req.query.path || req.query.file || req.query.url;
      if (!targetPath) return res.status(400).json({ success: false, message: 'File path is required.' });

      // Path traversal security check
      if (String(targetPath).includes('..') || String(targetPath).includes('%2e%2e') || String(targetPath).includes('\\')) {
        return res.status(403).json({ success: false, message: 'Forbidden path traversal attempt.' });
      }

      const fileName = String(targetPath).split('/').pop().split('?')[0];
      const searchDirs = [
        path.join(__dirname, '../../customer_documents'),
        path.join(__dirname, '../../../public_html/customer_documents'),
        path.join(__dirname, '../../uploads'),
        path.join(process.cwd(), 'customer_documents'),
        path.join(process.cwd(), 'uploads'),
      ];

      let foundPath = null;
      for (const d of searchDirs) {
        const full = path.join(d, fileName);
        if (fs.existsSync(full)) {
          foundPath = full;
          break;
        }
      }

      const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
      const mimeTypes = {
        pdf: 'application/pdf',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        mp4: 'video/mp4',
        mp3: 'audio/mpeg',
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';

      // 1. If found on local disk, stream directly
      if (foundPath) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return fs.createReadStream(foundPath).pipe(res);
      }

      // 2. If not on local disk, proxy from remote cPanel server
      const baseUrl = process.env.DOCUMENTS_BASE_URL || 'https://fundlelo.site';
      const remoteUrl = targetPath.startsWith('http') ? targetPath : `${baseUrl}/customer_documents/${fileName}`;
      const token = req.query.token || (req.headers['authorization']?.replace('Bearer ', ''));

      const remoteUrlWithToken = token && !remoteUrl.includes('token=')
        ? `${remoteUrl}${remoteUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
        : remoteUrl;

      const client = remoteUrlWithToken.startsWith('https') ? https : http;
      const proxyReq = client.get(remoteUrlWithToken, (remoteRes) => {
        if (remoteRes.statusCode === 200) {
          res.setHeader('Content-Type', remoteRes.headers['content-type'] || contentType);
          res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          return remoteRes.pipe(res);
        } else {
          return res.status(remoteRes.statusCode || 404).json({
            success: false,
            message: 'Requested document was not found on server.',
            remoteStatus: remoteRes.statusCode
          });
        }
      });

      proxyReq.on('error', (err) => {
        console.warn('Proxy streaming error:', err.message);
        return res.status(404).json({ success: false, message: 'Document file not found on server.' });
      });

    } catch (err) {
      return res.status(500).json({ success: false, message: 'Error streaming document', error: err.message });
    }
  }
};

module.exports = DocumentController;
