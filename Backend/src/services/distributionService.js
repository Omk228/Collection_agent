const { query } = require('../config/db');

/**
 * Get all active Collection Agents in the system
 * Synchronizes agents from panel_users (role = 'COLLECTION AGENT') and collection_agents table.
 */
async function getActiveCollectionAgents() {
  try {
    // 1. Check panel_users for active collection agents
    const puAgents = await query(`
      SELECT id, name, email, phone, role, status 
      FROM panel_users 
      WHERE (role = 'COLLECTION AGENT' OR role = 'Collection Agent') 
        AND status = 'ACTIVE'
      ORDER BY id ASC
    `);

    // Ensure each panel_user collection agent exists in collection_agents table
    for (const pu of puAgents) {
      const code = pu.id === 388 ? 'AG001' : `AG${String(pu.id).padStart(3, '0')}`;
      const existing = await query('SELECT id FROM collection_agents WHERE email = ? OR agent_code = ?', [pu.email, code]);
      if (existing.length === 0) {
        await query(`
          INSERT INTO collection_agents (agent_code, name, email, phone, role, status, password_hash)
          VALUES (?, ?, ?, ?, 'Collection Agent', 'ACTIVE', '$2b$10$22VEXPDcY6yl27mJLK7U1uziJTQySMH11ZhW7MrWiPJKRRgPSEoJW')
          ON DUPLICATE KEY UPDATE status = 'ACTIVE'
        `, [code, pu.name, pu.email, pu.phone || '+919876543210']);
      }
    }

    // 2. Fetch all active agents from collection_agents
    const agents = await query(`
      SELECT id, agent_code, name, email, phone, status 
      FROM collection_agents 
      WHERE status = 'ACTIVE'
      ORDER BY id ASC
    `);

    if (agents.length === 0) {
      // Fallback default agent
      return [{
        id: 388,
        agent_code: 'AG001',
        name: 'Collection Agent',
        email: 'collectionagent@fundlelo.site',
        phone: '+919876543210',
        status: 'ACTIVE'
      }];
    }

    return agents;
  } catch (error) {
    console.error('[distributionService] Error getting active collection agents:', error.message);
    return [{
      id: 388,
      agent_code: 'AG001',
      name: 'Collection Agent',
      email: 'collectionagent@fundlelo.site',
      phone: '+919876543210',
      status: 'ACTIVE'
    }];
  }
}

/**
 * Auto-assigns all cases with status 'SENT_TO_COLLECTION_AGENT' across
 * loan_accounts, leads, and collections using Round-Robin distribution
 * among available active collection agents.
 */
async function autoAssignSentCases() {
  try {
    const activeAgents = await getActiveCollectionAgents();
    if (activeAgents.length === 0) return { assignedCount: 0, cases: [] };

    // 1. Fetch cases from loan_accounts where status = 'SENT_TO_COLLECTION_AGENT'
    const sentLoans = await query(`
      SELECT 
        id as loan_id,
        borrower as name,
        phone,
        email,
        COALESCE(outstanding, next_amount, principal, 0) as amount_due,
        COALESCE(next_amount, 0) as emi_amount,
        COALESCE(principal, 50000) as loan_amount,
        due_date,
        assigned_agent,
        status
      FROM loan_accounts 
      WHERE status = 'SENT_TO_COLLECTION_AGENT'
    `);

    // 2. Fetch cases from leads where status = 'SENT_TO_COLLECTION_AGENT'
    const sentLeads = await query(`
      SELECT 
        ld.id as lead_pk,
        CONCAT('LN-', ld.lead_number) as loan_id,
        ld.name,
        ld.mobile as phone,
        ld.email,
        COALESCE(ld.approved_amount, ld.requested_amount, 50000) as loan_amount,
        COALESCE(ld.approved_amount, ld.requested_amount, 50000) as amount_due,
        ROUND(COALESCE(ld.approved_amount, ld.requested_amount, 50000) / 6) as emi_amount,
        ld.assigned_to,
        ld.status
      FROM leads ld
      WHERE ld.status = 'SENT_TO_COLLECTION_AGENT'
    `).catch((err) => {
      console.warn('[distributionService] sentLeads query notice:', err.message);
      return [];
    });

    // 3. Fetch cases from collections table where status = 'SENT_TO_COLLECTION_AGENT'
    const sentCollections = await query(`
      SELECT 
        COALESCE(invoice_no, collection_id, CONCAT('COL-', id)) as loan_id,
        customer_name as name,
        '' as phone,
        '' as email,
        COALESCE(balance_due, invoice_amount, amount, 0) as amount_due,
        COALESCE(balance_due, invoice_amount, amount, 0) as emi_amount,
        COALESCE(balance_due, invoice_amount, amount, 0) as loan_amount,
        due_date,
        assigned_to,
        status
      FROM collections 
      WHERE status = 'SENT_TO_COLLECTION_AGENT'
    `).catch(() => []);

    // Combine all unassigned/sent cases
    const allSentCases = [];
    const seenLoanIds = new Set();

    for (const l of sentLoans) {
      if (!seenLoanIds.has(l.loan_id)) {
        seenLoanIds.add(l.loan_id);
        allSentCases.push({ ...l, sourceType: 'loan_accounts' });
      }
    }

    for (const ld of sentLeads) {
      if (!seenLoanIds.has(ld.loan_id)) {
        seenLoanIds.add(ld.loan_id);
        allSentCases.push({ ...ld, sourceType: 'leads' });
      }
    }

    for (const c of sentCollections) {
      if (!seenLoanIds.has(c.loan_id)) {
        seenLoanIds.add(c.loan_id);
        allSentCases.push({ ...c, sourceType: 'collections' });
      }
    }

    // 4. Purge any cases from collection_customers that are Closed/Settled or no longer SENT_TO_COLLECTION_AGENT
    await query(`
      DELETE FROM collection_customers 
      WHERE loan_id IN (
        SELECT id FROM loan_accounts 
        WHERE status IN ('Closed', 'Settled', 'CLOSED', 'SETTLED')
           OR (status != 'SENT_TO_COLLECTION_AGENT' AND status IS NOT NULL)
      )
    `);

    await query(`
      DELETE FROM collection_customers 
      WHERE loan_id IN (
        SELECT CONCAT('LN-', lead_number) FROM leads 
        WHERE status != 'SENT_TO_COLLECTION_AGENT' AND status IS NOT NULL
      )
    `);

    // 5. Track current case count per agent for load-balanced Round-Robin
    const currentCounts = await query(`
      SELECT assigned_agent_code, COUNT(*) as count 
      FROM collection_customers 
      WHERE status = 'SENT_TO_COLLECTION_AGENT'
      GROUP BY assigned_agent_code
    `);

    const agentLoadMap = {};
    activeAgents.forEach(a => { agentLoadMap[a.agent_code] = 0; });
    currentCounts.forEach(r => {
      if (agentLoadMap[r.assigned_agent_code] !== undefined) {
        agentLoadMap[r.assigned_agent_code] = parseInt(r.count, 10);
      }
    });

    let assignedThisRound = 0;
    const assignmentsResult = [];

    // 6. Process each SENT_TO_COLLECTION_AGENT case
    for (const item of allSentCases) {
      // Check if already assigned in collection_customers
      const existing = await query(`
        SELECT id, assigned_agent_code, status 
        FROM collection_customers 
        WHERE loan_id = ?
      `, [item.loan_id]);

      let targetAgent = null;

      if (existing.length > 0) {
        // Case already exists in collection_customers
        const currentAgentCode = existing[0].assigned_agent_code;
        const agentExists = activeAgents.find(a => a.agent_code === currentAgentCode);

        if (agentExists) {
          // Already properly assigned to an active agent
          targetAgent = agentExists;
        } else {
          // Current agent is inactive or invalid, re-assign via Round Robin
          targetAgent = pickNextRoundRobinAgent(activeAgents, agentLoadMap);
        }

        // Ensure status and amount are up to date
        await query(`
          UPDATE collection_customers 
          SET assigned_agent_code = ?,
              status = 'SENT_TO_COLLECTION_AGENT',
              amount_due = ?,
              updated_at = NOW()
          WHERE id = ?
        `, [targetAgent.agent_code, parseFloat(item.amount_due) || 0, existing[0].id]);

      } else {
        // NEW UNASSIGNED CASE: Select agent using Round-Robin (least loaded first)
        // Check if item already specified a valid active agent in source table
        if (item.assigned_agent) {
          const directMatch = activeAgents.find(a => 
            a.agent_code === item.assigned_agent || 
            a.name.toLowerCase() === item.assigned_agent.toLowerCase() ||
            String(a.id) === String(item.assigned_agent)
          );
          if (directMatch) {
            targetAgent = directMatch;
          }
        }

        if (!targetAgent) {
          targetAgent = pickNextRoundRobinAgent(activeAgents, agentLoadMap);
        }

        // Insert into collection_customers
        const rawDue = item.due_date ? String(item.due_date).trim() : '2026-11-01';
        let formattedDue = '2026-11-01';
        if (rawDue.includes('-')) {
          const parts = rawDue.split('-');
          if (parts[0].length === 4) formattedDue = rawDue;
          else if (parts[2] && parts[2].length === 4) formattedDue = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }

        await query(`
          INSERT INTO collection_customers
          (name, phone, email, address, loan_id, loan_amount, amount_due, emi_amount, due_date, status, days_past_due, principal_balance, interest_rate, loan_tenure, remaining_tenure, assigned_agent_code, latitude, longitude)
          VALUES (?, ?, ?, 'Delhi NCR', ?, ?, ?, ?, ?, 'SENT_TO_COLLECTION_AGENT', 15, ?, 16.0, 12, 6, ?, 28.6139, 77.2090)
        `, [
          item.name || 'Borrower',
          item.phone || '9999999999',
          item.email || '',
          item.loan_id,
          parseFloat(item.loan_amount) || 50000,
          parseFloat(item.amount_due) || 25000,
          parseFloat(item.emi_amount) || 5000,
          formattedDue,
          parseFloat(item.loan_amount) || 50000,
          targetAgent.agent_code
        ]);

        // Update source table
        if (item.sourceType === 'loan_accounts') {
          await query(`
            UPDATE loan_accounts 
            SET assigned_agent = ?, updated_at = NOW() 
            WHERE id = ?
          `, [targetAgent.name, item.loan_id]);
        } else if (item.sourceType === 'leads' && item.lead_pk) {
          await query(`
            UPDATE leads 
            SET assigned_to = ?, collection_agent = ?, updated_at = NOW() 
            WHERE id = ?
          `, [targetAgent.id, targetAgent.name, item.lead_pk]);
        }

        // Audit log
        await query(`
          INSERT INTO agent_audit_logs (agent_code, agent_name, action, entity_type, entity_id, details)
          VALUES (?, ?, 'AUTO_ASSIGN_ROUND_ROBIN', 'LOAN', ?, ?)
        `, [
          targetAgent.agent_code,
          targetAgent.name,
          item.loan_id,
          `Case ${item.loan_id} auto-assigned to ${targetAgent.name} (${targetAgent.agent_code}) via Round-Robin distribution`
        ]);

        // Increment load
        agentLoadMap[targetAgent.agent_code] = (agentLoadMap[targetAgent.agent_code] || 0) + 1;
        assignedThisRound++;

        assignmentsResult.push({
          loanId: item.loan_id,
          borrower: item.name,
          amountDue: item.amount_due,
          assignedTo: targetAgent.name,
          agentCode: targetAgent.agent_code
        });
      }
    }

    return {
      success: true,
      totalActiveAgents: activeAgents.length,
      assignedThisRound,
      totalSentCases: allSentCases.length,
      assignments: assignmentsResult
    };

  } catch (err) {
    console.error('[distributionService] Error in autoAssignSentCases:', err);
    return { success: false, error: err.message };
  }
}

// Cyclic pointer for tie-breaking round-robin
let rrPointer = 0;

/**
 * Helper: Picks the next agent using Round-Robin (least-loaded first, cyclic tie-breaking)
 */
function pickNextRoundRobinAgent(agents, loadMap) {
  if (!agents || agents.length === 0) return null;
  if (agents.length === 1) return agents[0];

  // 1. Find min load
  let minLoad = Infinity;
  for (const a of agents) {
    const load = loadMap[a.agent_code] || 0;
    if (load < minLoad) minLoad = load;
  }

  // 2. Candidates with min load
  const candidates = agents.filter(a => (loadMap[a.agent_code] || 0) === minLoad);

  // 3. Cyclic rotation among candidates
  const selected = candidates[rrPointer % candidates.length];
  rrPointer = (rrPointer + 1) % 10000;
  return selected;
}

module.exports = {
  getActiveCollectionAgents,
  autoAssignSentCases
};
