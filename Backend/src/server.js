const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const { testConnection } = require('./config/db');
const { initSchema } = require('./config/initSchema');
const { autoAssignSentCases } = require('./services/distributionService');
const { getCustomerRepaymentsBaseDir } = require('./services/repaymentStorageService');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const agentRoutes = require('./routes/agentRoutes');
const customerRoutes = require('./routes/customerRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const cashSubmissionRoutes = require('./routes/cashSubmissionRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const locationRoutes = require('./routes/locationRoutes');
const visitRoutes = require('./routes/visitRoutes');
const taskRoutes = require('./routes/taskRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const auditRoutes = require('./routes/auditRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const documentRoutes = require('./routes/documentRoutes');
const { protectStaticDocs } = require('./middleware/securityMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all incoming frontend clients
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-agent-code']
}));

// Body parsers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Logging
app.use(morgan('dev'));

// Static uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Static customer_repayments folder (outside public_html)
const customerRepaymentsDir = getCustomerRepaymentsBaseDir();
app.use('/customer_repayments', express.static(customerRepaymentsDir));
app.use('/api/customer_repayments', express.static(customerRepaymentsDir));

const localRepaymentsDir = path.resolve(process.cwd(), 'customer_repayments');
if (fs.existsSync(localRepaymentsDir) && localRepaymentsDir !== customerRepaymentsDir) {
  app.use('/customer_repayments', express.static(localRepaymentsDir));
}

// Static customer_documents search locations for cPanel & Local (Protected with Zero-Trust)
const docSearchPaths = [
  path.join(__dirname, '../customer_documents'),
  path.join(__dirname, '../../customer_documents'),
  path.join(__dirname, '../../../customer_documents'), // /home/<user>/customer_documents on cPanel
  path.join(__dirname, '../../public_html/customer_documents'),
  path.join(process.cwd(), 'customer_documents'),
  'C:/Users/Om Kumar Jha/Desktop/Fund_lelo/customer_documents'
];

docSearchPaths.forEach((dir) => {
  if (fs.existsSync(dir)) {
    app.use(['/customer_documents', '/api/customer_documents'], protectStaticDocs, express.static(dir));
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Fundlelo Loan Collection Agent API',
    database: {
      connected: dbStatus,
      host: process.env.DB_HOST,
      name: process.env.DB_NAME
    },
    cpanel: {
      domain: process.env.CPANEL_DOMAIN,
      ip: process.env.CPANEL_IP,
      user: process.env.CPANEL_USERNAME,
      contact: process.env.CPANEL_CONTACT_EMAIL
    }
  });
});

// Mount API routes (Standard format)
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cash-submissions', cashSubmissionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/documents', documentRoutes);

// Universal /api/agent/... aliases for full specification & external contract compatibility
app.use('/api/agent/auth', authRoutes);
app.use('/api/agent/profile', agentRoutes);
app.use('/api/agent/customers', customerRoutes);
app.use('/api/agent/documents', documentRoutes);
app.use('/api/agent/payments', paymentRoutes);
app.use('/api/agent/cash-submission', cashSubmissionRoutes);
app.use('/api/agent/cash-submissions', cashSubmissionRoutes);
app.use('/api/agent/attendance', attendanceRoutes);
app.use('/api/agent/location', locationRoutes);
app.use('/api/agent/visits', visitRoutes);
app.use('/api/agent/tasks', taskRoutes);
app.use('/api/agent/notifications', notificationRoutes);
app.use('/api/agent/audit', auditRoutes);

// Error Handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    const isDbConnected = await testConnection();
    if (isDbConnected) {
      await initSchema();
    } else {
      console.warn('[Warning] MySQL connection could not be established immediately. Server will start anyway.');
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`🚀 Fundlelo Collection Agent Backend Server Running!`);
      console.log(`📡 Local URL:  http://localhost:${PORT}`);
      console.log(`🌐 Network:    http://0.0.0.0:${PORT}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`🗄️ Database:   ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
      console.log(`🔄 Distribution: Round-Robin Engine Active (Auto-sync every 30s)`);
      console.log(`====================================================`);

      // Periodic Round-Robin distribution runner for SENT_TO_COLLECTION_AGENT cases
      setInterval(async () => {
        try {
          await autoAssignSentCases();
        } catch (e) {
          console.warn('[RoundRobin Runner Notice]:', e.message);
        }
      }, 30 * 1000);
    });
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
}

startServer();
