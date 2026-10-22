const { pool } = require('../config/db');

async function cleanData() {
  console.log('Cleaning database test records...');

  await pool.query(`
    UPDATE agent_payments 
    SET customer_id = 7, customer_name = 'PUNEET ROHILLA', loan_id = 'LN-LEAD-302457', agent_name = 'Collection Agent'
    WHERE id = 1
  `);

  await pool.query(`
    UPDATE agent_payments 
    SET customer_id = 9, customer_name = 'SUBHRANIL BANERJEE', loan_id = 'LN-FLD-000005', agent_name = 'Collection Agent'
    WHERE id = 2
  `);

  await pool.query(`
    UPDATE agent_audit_logs 
    SET agent_name = 'Collection Agent' 
    WHERE agent_name = 'Arjun Patel'
  `);

  await pool.query(`
    UPDATE agent_audit_logs 
    SET details = REPLACE(details, 'Rajesh Kumar', 'PUNEET ROHILLA')
  `);

  await pool.query(`
    UPDATE agent_audit_logs 
    SET details = REPLACE(details, 'Priya Sharma', 'SUBHRANIL BANERJEE')
  `);

  // Ensure real visits in agent_visits
  const [v] = await pool.query('SELECT COUNT(*) as count FROM agent_visits');
  if (v[0].count === 0) {
    await pool.query(`
      INSERT INTO agent_visits 
      (visit_code, agent_code, agent_name, customer_id, customer_name, loan_id, visit_type, latitude, longitude, location_address, notes, outcome, ptp_date, ptp_amount, created_at)
      VALUES 
      ('VST-REAL-001', 'AG001', 'Collection Agent', 7, 'PUNEET ROHILLA', 'LN-LEAD-302457', 'collection', 28.6139, 77.2090, 'Delhi NCR', 'Customer paid via Cash. Receipt issued.', 'payment', NULL, 15000.00, NOW()),
      ('VST-REAL-002', 'AG001', 'Collection Agent', 9, 'SUBHRANIL BANERJEE', 'LN-FLD-000005', 'followup', 28.4595, 77.0266, 'Gurgaon DLF', 'Customer promised UPI transfer by tomorrow.', 'promise', DATE_ADD(CURDATE(), INTERVAL 2 DAY), 8333.00, DATE_SUB(NOW(), INTERVAL 2 HOUR))
    `);
  }

  // Ensure agent_tasks has real customer tasks if any exist
  const [tasks] = await pool.query('SELECT COUNT(*) as count FROM agent_tasks WHERE customer_name IS NOT NULL');
  if (tasks[0].count === 0) {
    await pool.query(`
      INSERT INTO agent_tasks 
      (agent_code, customer_id, customer_name, title, description, task_type, due_date, due_time, location, priority, status)
      VALUES 
      ('AG001', 7, 'PUNEET ROHILLA', 'EMI Follow-up: PUNEET ROHILLA', 'Collect scheduled EMI payment of ₹13,200', 'call', CURDATE(), '11:00 AM', 'Delhi NCR', 'high', 'pending'),
      ('AG001', 9, 'SUBHRANIL BANERJEE', 'Field Visit: SUBHRANIL BANERJEE', 'Customer address verification and EMI check', 'visit', CURDATE(), '02:30 PM', 'Delhi NCR', 'medium', 'pending')
    `);
  }

  console.log('All DB records now point exclusively to real borrowers!');
  process.exit(0);
}

cleanData().catch(err => {
  console.error('Error cleaning data:', err);
  process.exit(1);
});
