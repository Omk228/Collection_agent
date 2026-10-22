const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

async function setupNewCollectionAgent() {
  const email = 'collectionagent@fundlelo.site';
  const rawPass = 'agent@123';
  const roleName = 'Collection Agent';
  const agentCode = 'AG001';
  const agentName = 'Collection Agent';
  const phone = '+919876543210';

  const passwordHash = await bcrypt.hash(rawPass, 10);

  // 1. Clear old agents from collection_agents
  await pool.query('DELETE FROM collection_agents');
  console.log('[Database] Cleared previous agents from collection_agents.');

  // 2. Insert new collection agent into collection_agents
  await pool.query(`
    INSERT INTO collection_agents 
    (agent_code, name, email, phone, password_hash, role, permissions, territory, experience, rating, target_collections, target_calls, target_visits, target_payments, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Delhi NCR', '3 years', 4.9, 200000.00, 30, 10, 12, 'ACTIVE')
  `, [
    agentCode,
    agentName,
    email,
    phone,
    passwordHash,
    roleName,
    JSON.stringify(['all'])
  ]);
  console.log(`[Database] Inserted new agent in collection_agents with role: "${roleName}".`);

  // 3. Upsert into panel_users as well for centralized panel sync
  const [existingPu] = await pool.query('SELECT id FROM panel_users WHERE email = ?', [email]);
  if (existingPu.length > 0) {
    await pool.query('UPDATE panel_users SET password_hash = ?, role = "COLLECTION", name = ?, status = "ACTIVE" WHERE email = ?', [passwordHash, agentName, email]);
    console.log('[Database] Updated panel_users entry for collectionagent@fundlelo.site.');
  } else {
    await pool.query(`
      INSERT INTO panel_users (name, email, phone, password_hash, role, status)
      VALUES (?, ?, ?, ?, 'COLLECTION', 'ACTIVE')
    `, [agentName, email, phone, passwordHash]);
    console.log('[Database] Created panel_users entry for collectionagent@fundlelo.site.');
  }

  // 4. Update customer cases to point to this agent
  await pool.query('UPDATE collection_customers SET assigned_agent_code = ?', [agentCode]);
  console.log('[Database] Assigned all customer collection cases to', agentCode);

  // Verify
  const [finalAgents] = await pool.query('SELECT id, agent_code, name, email, phone, role, status FROM collection_agents');
  console.log('Final Collection Agents:');
  console.table(finalAgents);

  const [finalPu] = await pool.query('SELECT id, name, email, role, status FROM panel_users WHERE email = ?', [email]);
  console.log('Panel Users entry:');
  console.table(finalPu);
}

setupNewCollectionAgent()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
