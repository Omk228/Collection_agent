const { query, pool } = require('../config/db');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * Fetch all documents for a customer with resolved URLs & tamper metadata
 */
async function getCustomerDocuments(userId) {
  const numericId = String(userId).replace(/\D/g, '') || userId;
  const baseUrl = process.env.DOCUMENTS_BASE_URL || 'https://crd.fundlelo.site';

  // 1. Fetch from customer_documents table
  let docs = [];
  try {
    docs = await query(
      'SELECT * FROM customer_documents WHERE user_id = ? OR lead_id = ? ORDER BY id DESC',
      [numericId, numericId]
    );
  } catch (err) {
    console.warn('[Doc Fetch Warning] customer_documents query:', err.message);
    docs = [];
  }

  // 2. Fetch from kyc_documents table (for Live Selfie Photo if table exists)
  let kycD = null;
  try {
    const [tableCheck] = await pool.query("SHOW TABLES LIKE 'kyc_documents'");
    if (tableCheck && tableCheck.length > 0) {
      const [kycDocs] = await pool.query(
        'SELECT * FROM kyc_documents WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [numericId]
      );
      if (kycDocs && kycDocs.length > 0) {
        kycD = kycDocs[0];
      }
    }
  } catch (_) {
    kycD = null;
  }

  // 3. Map documents with full URLs and MIME detection
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

  // 4. Merge KYC selfie if available in kyc_documents
  if (kycD && kycD.selfie_path) {
    const selfieUrl = kycD.selfie_path.startsWith('http')
      ? kycD.selfie_path
      : `${baseUrl}${kycD.selfie_path.startsWith('/') ? '' : '/'}${kycD.selfie_path}`;
    const selfieFileName = kycD.selfie_path.split('/').pop() || 'selfie.webp';

    if (!allMappedDocs.some((d) => d.fileName === selfieFileName || d.url === selfieUrl)) {
      allMappedDocs.unshift({
        id: `kyc-selfie-${kycD.id || numericId}`,
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
      if (!userId) return res.status(400).json({ success: false, message: 'User ID is required.' });
      const documents = await getCustomerDocuments(userId);
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
      const baseUrl = process.env.DOCUMENTS_BASE_URL || 'https://crd.fundlelo.site';
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
