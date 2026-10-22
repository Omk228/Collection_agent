const { pool } = require('../config/db');

async function showLeads() {
  const [rows] = await pool.query(`
    SELECT id, name, mobile, status, assigned_to, requested_amount, approved_amount 
    FROM leads 
    WHERE name IS NOT NULL AND name != '' AND name != 'Applicant'
  `);
  console.table(rows);
  process.exit(0);
}

showLeads().catch(err => {
  console.error(err);
  process.exit(1);
});
