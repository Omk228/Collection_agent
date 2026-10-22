const { pool } = require('./src/config/db');

async function testQuery() {
  const [rows] = await pool.query(`
    SELECT 
      ld.id, 
      ld.name, 
      ld.mobile, 
      ld.email, 
      COALESCE(ld.approved_amount, ld.requested_amount, 50000) as amount, 
      ld.status, 
      u.current_address, 
      u.city, 
      u.state, 
      u.monthly_income, 
      u.employment_type
    FROM leads ld 
    LEFT JOIN users u ON ld.user_id = u.id 
    WHERE ld.name IS NOT NULL AND ld.name != '' AND ld.name != 'Applicant'
    LIMIT 10
  `);
  console.table(rows);
  process.exit(0);
}

testQuery().catch(err => {
  console.error(err);
  process.exit(1);
});
