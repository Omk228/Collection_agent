const { query } = require('./db');
const bcrypt = require('bcryptjs');

async function initSchema() {
  console.log('[Database] Checking & initializing tables...');

  // 1. collection_agents
  await query(`
    CREATE TABLE IF NOT EXISTS collection_agents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      agent_code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(50),
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'Junior Agent',
      permissions JSON,
      territory VARCHAR(150) DEFAULT 'Central Delhi District',
      experience VARCHAR(50) DEFAULT '2 years',
      rating DECIMAL(3,1) DEFAULT 4.8,
      avatar VARCHAR(255) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      shift_active TINYINT(1) DEFAULT 1,
      target_collections DECIMAL(15,2) DEFAULT 170000,
      target_calls INT DEFAULT 25,
      target_visits INT DEFAULT 8,
      target_payments INT DEFAULT 10,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. collection_customers
  await query(`
    CREATE TABLE IF NOT EXISTS collection_customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(150),
      address TEXT NOT NULL,
      photo_id VARCHAR(500),
      loan_id VARCHAR(100) NOT NULL,
      loan_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      amount_due DECIMAL(15,2) NOT NULL DEFAULT 0,
      emi_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
      due_date DATE NOT NULL,
      last_payment DATE,
      status ENUM('current', 'overdue', 'delinquent') DEFAULT 'current',
      days_past_due INT DEFAULT 0,
      overdue_days INT DEFAULT 0,
      principal_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
      interest_rate DECIMAL(5,2) NOT NULL DEFAULT 16.00,
      loan_tenure INT DEFAULT 24,
      remaining_tenure INT DEFAULT 18,
      co_applicant_name VARCHAR(150),
      co_applicant_phone VARCHAR(50),
      occupation VARCHAR(150),
      monthly_income DECIMAL(15,2) DEFAULT 0,
      assigned_agent_code VARCHAR(50) DEFAULT 'AG001',
      latitude DECIMAL(10,8) DEFAULT 28.6139,
      longitude DECIMAL(11,8) DEFAULT 77.2090,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. agent_payments
  await query(`
    CREATE TABLE IF NOT EXISTS agent_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      receipt_number VARCHAR(100) NOT NULL UNIQUE,
      customer_id INT NOT NULL,
      customer_name VARCHAR(150) NOT NULL,
      loan_id VARCHAR(100) NOT NULL,
      agent_code VARCHAR(50) NOT NULL,
      agent_name VARCHAR(150) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash',
      transaction_reference VARCHAR(150),
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(50) DEFAULT 'success',
      notes TEXT,
      receipt_url VARCHAR(500),
      latitude DECIMAL(10,8),
      longitude DECIMAL(11,8),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4. cash_submissions
  await query(`
    CREATE TABLE IF NOT EXISTS cash_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      submission_code VARCHAR(100) NOT NULL UNIQUE,
      agent_code VARCHAR(50) NOT NULL,
      agent_name VARCHAR(150) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      denominations JSON,
      submission_type VARCHAR(50) DEFAULT 'branch',
      status VARCHAR(50) DEFAULT 'PENDING',
      notes TEXT,
      receipt_url VARCHAR(500),
      approved_by VARCHAR(100),
      approved_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 5. agent_attendance
  await query(`
    CREATE TABLE IF NOT EXISTS agent_attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      agent_code VARCHAR(50) NOT NULL,
      date DATE NOT NULL,
      punch_in_time DATETIME,
      punch_out_time DATETIME,
      punch_in_lat DECIMAL(10,8),
      punch_in_lng DECIMAL(11,8),
      punch_in_address VARCHAR(255),
      punch_out_lat DECIMAL(10,8),
      punch_out_lng DECIMAL(11,8),
      punch_out_address VARCHAR(255),
      battery_level INT,
      device_info VARCHAR(255),
      status VARCHAR(50) DEFAULT 'PRESENT',
      working_hours DECIMAL(5,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 6. agent_locations
  await query(`
    CREATE TABLE IF NOT EXISTS agent_locations (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      agent_code VARCHAR(50) NOT NULL,
      agent_name VARCHAR(150),
      latitude DECIMAL(10,8) NOT NULL,
      longitude DECIMAL(11,8) NOT NULL,
      accuracy DECIMAL(6,2) DEFAULT 10.0,
      battery_level INT DEFAULT 85,
      speed DECIMAL(5,2) DEFAULT 0,
      address VARCHAR(255),
      location_type VARCHAR(50) DEFAULT 'PING',
      is_login TINYINT(1) DEFAULT 0,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  try {
    await query(`ALTER TABLE agent_locations ADD COLUMN location_type VARCHAR(50) DEFAULT 'PING'`);
  } catch (_) {}
  try {
    await query(`ALTER TABLE agent_locations ADD COLUMN is_login TINYINT(1) DEFAULT 0`);
  } catch (_) {}


  // 7. agent_visits
  await query(`
    CREATE TABLE IF NOT EXISTS agent_visits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      visit_code VARCHAR(100) NOT NULL UNIQUE,
      agent_code VARCHAR(50) NOT NULL,
      agent_name VARCHAR(150) NOT NULL,
      customer_id INT NOT NULL,
      customer_name VARCHAR(150) NOT NULL,
      loan_id VARCHAR(100) NOT NULL,
      visit_type VARCHAR(50) DEFAULT 'regular_followup',
      latitude DECIMAL(10,8),
      longitude DECIMAL(11,8),
      location_address VARCHAR(255),
      photo_proof_url VARCHAR(500),
      signature_url VARCHAR(500),
      notes TEXT,
      outcome VARCHAR(100) DEFAULT 'visit_completed',
      ptp_date DATE,
      ptp_amount DECIMAL(15,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 8. agent_tasks
  await query(`
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      agent_code VARCHAR(50) NOT NULL,
      customer_id INT,
      customer_name VARCHAR(150),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      task_type VARCHAR(50) DEFAULT 'visit',
      due_date DATE NOT NULL,
      due_time VARCHAR(20) DEFAULT '10:00 AM',
      location VARCHAR(255),
      priority VARCHAR(20) DEFAULT 'medium',
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 9. agent_notifications
  await query(`
    CREATE TABLE IF NOT EXISTS agent_notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      agent_code VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      is_read TINYINT(1) DEFAULT 0,
      metadata_json JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 10. agent_audit_logs
  await query(`
    CREATE TABLE IF NOT EXISTS agent_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      agent_code VARCHAR(50) NOT NULL,
      agent_name VARCHAR(150) NOT NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50),
      entity_id VARCHAR(100),
      details TEXT,
      ip_address VARCHAR(50),
      latitude DECIMAL(10,8),
      longitude DECIMAL(11,8),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('[Database] Tables checked/created successfully.');

  // Seed default agents if none exist
  await seedDefaultData();
}

async function seedDefaultData() {
  const existingAgents = await query('SELECT COUNT(*) as cnt FROM collection_agents');
  if (existingAgents[0].cnt === 0) {
    console.log('[Database] Seeding default agents...');

    const defaultAgents = [
      {
        code: 'AG001',
        name: 'Collection Agent',
        email: 'collectionagent@fundlelo.site',
        phone: '+919876543210',
        pass: 'agent@123',
        role: 'Collection Agent',
        territory: 'Delhi NCR',
        experience: '3 years',
        rating: 4.9,
        target_collections: 200000,
        target_calls: 30,
        target_visits: 10,
        target_payments: 12
      }
    ];

    for (const ag of defaultAgents) {
      const hashedPass = await bcrypt.hash(ag.pass, 10);
      await query(`
        INSERT INTO collection_agents 
        (agent_code, name, email, phone, password_hash, role, permissions, territory, experience, rating, target_collections, target_calls, target_visits, target_payments, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `, [ag.code, ag.name, ag.email, ag.phone, hashedPass, ag.role, JSON.stringify(['all']), ag.territory, ag.experience, ag.rating, ag.target_collections, ag.target_calls, ag.target_visits, ag.target_payments]);
    }
    console.log('[Database] Real agents seeded.');
  }

  }

module.exports = {
  initSchema
};
