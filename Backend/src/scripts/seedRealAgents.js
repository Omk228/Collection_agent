const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

async function seedRealAgents() {
  const agents = [
    {
      code: 'AG101',
      name: 'Puneet Rohilla',
      email: 'puneetrohilla@fundlelo.com',
      phone: '7042089989',
      pass: 'Puneet@2026',
      role: 'Senior Recovery Officer',
      territory: 'Delhi NCR - North & West',
      experience: '4 years',
      rating: 4.9,
      target_collections: 200000,
      target_calls: 30,
      target_visits: 10,
      target_payments: 12
    },
    {
      code: 'AG102',
      name: 'Om Kumar Jha',
      email: 'om@fundlelo.site',
      phone: '8882746176',
      pass: 'Om@2026',
      role: 'Collection Supervisor',
      territory: 'Delhi NCR - Central',
      experience: '3.5 years',
      rating: 4.8,
      target_collections: 250000,
      target_calls: 25,
      target_visits: 12,
      target_payments: 15
    },
    {
      code: 'AG103',
      name: 'Shubham Gupta',
      email: 'shubham@fundlelo.site',
      phone: '9650843194',
      pass: 'Shubham@2026',
      role: 'Field Collection Agent',
      territory: 'East Delhi & Noida',
      experience: '2 years',
      rating: 4.7,
      target_collections: 150000,
      target_calls: 25,
      target_visits: 8,
      target_payments: 10
    },
    {
      code: 'AG104',
      name: 'Chandra Kishore',
      email: 'Chandrakishore@fundlelo.com',
      phone: '92179990822',
      pass: 'Chandra@2026',
      role: 'Recovery Officer',
      territory: 'South Delhi & Faridabad',
      experience: '3 years',
      rating: 4.8,
      target_collections: 180000,
      target_calls: 20,
      target_visits: 9,
      target_payments: 11
    },
    {
      code: 'AG105',
      name: 'Piyush Pandey',
      email: 'piyush@fundlelo.site',
      phone: '9855965898',
      pass: 'Piyush@2026',
      role: 'Senior Field Agent',
      territory: 'Gurugram & NCR West',
      experience: '3 years',
      rating: 4.8,
      target_collections: 190000,
      target_calls: 22,
      target_visits: 10,
      target_payments: 12
    },
    {
      code: 'AG001',
      name: 'Collection Agent',
      email: 'collectionagent@fundlelo.site',
      phone: '+919876543210',
      pass: 'agent@123',
      role: 'COLLECTION AGENT',
      territory: 'Delhi NCR',
      experience: '3 years',
      rating: 4.9,
      target_collections: 170000,
      target_calls: 25,
      target_visits: 8,
      target_payments: 10
    }
  ];

  for (const ag of agents) {
    const hash = await bcrypt.hash(ag.pass, 10);
    const [exists] = await pool.query('SELECT id FROM collection_agents WHERE agent_code = ?', [ag.code]);
    if (exists.length > 0) {
      await pool.query(
        `UPDATE collection_agents 
         SET name = ?, email = ?, phone = ?, password_hash = ?, role = ?, territory = ?, experience = ?, rating = ?, target_collections = ?, target_calls = ?, target_visits = ?, target_payments = ?, status = 'ACTIVE' 
         WHERE agent_code = ?`,
        [ag.name, ag.email, ag.phone, hash, ag.role, ag.territory, ag.experience, ag.rating, ag.target_collections, ag.target_calls, ag.target_visits, ag.target_payments, ag.code]
      );
      console.log(`[Database] Updated agent ${ag.code} (${ag.name})`);
    } else {
      await pool.query(
        `INSERT INTO collection_agents 
         (agent_code, name, email, phone, password_hash, role, permissions, territory, experience, rating, target_collections, target_calls, target_visits, target_payments, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [ag.code, ag.name, ag.email, ag.phone, hash, ag.role, JSON.stringify(['all']), ag.territory, ag.experience, ag.rating, ag.target_collections, ag.target_calls, ag.target_visits, ag.target_payments]
      );
      console.log(`[Database] Inserted new agent ${ag.code} (${ag.name})`);
    }
  }

  // Remove obsolete demo agents AG002 and AG003
  await pool.query(`DELETE FROM collection_agents WHERE agent_code IN ('AG002', 'AG003')`);
  console.log('[Database] Cleaned up old demo records AG002, AG003.');

  const [activeList] = await pool.query('SELECT agent_code, name, email, phone, role, status FROM collection_agents ORDER BY agent_code');
  console.log('Active Collection Agents in DB:');
  console.table(activeList);
}

if (require.main === module) {
  seedRealAgents()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedRealAgents };
