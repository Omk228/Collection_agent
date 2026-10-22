const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '103.218.126.44',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'fundlelo',
  password: process.env.DB_PASSWORD || 'E^0r)hYXA7q,QHys',
  database: process.env.DB_NAME || 'fundlelo_db',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  connectTimeout: 10000,
  dateStrings: true,
});

// Helper for queries
async function query(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error('Database Query Error:', error.message, '\nSQL:', sql);
    throw error;
  }
}

// Test connectivity
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log(`[Database] Connected successfully to MySQL (${process.env.DB_NAME} at ${process.env.DB_HOST}:${process.env.DB_PORT})`);
    conn.release();
    return true;
  } catch (err) {
    console.error('[Database] Connection Failed:', err.message);
    return false;
  }
}

module.exports = {
  pool,
  query,
  testConnection
};
