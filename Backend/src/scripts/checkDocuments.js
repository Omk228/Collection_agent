const { query } = require('../config/db');

async function test() {
  const rawId = '68';
  const idStr = String(rawId).trim();
  const custRows = await query('SELECT id, name, phone, loan_id FROM collection_customers WHERE id = ? OR loan_id = ?', [rawId, idStr]);
  console.log('custRows:', custRows);

  if (custRows.length > 0) {
    const c = custRows[0];
    const cleanLoan = String(c.loan_id || '').replace(/^LN-/i, '');
    console.log('loan_id:', c.loan_id, 'cleanLoan:', cleanLoan, 'phone:', c.phone);

    const leadRows = await query(
      `SELECT id, user_id, lead_number, mobile FROM leads 
       WHERE lead_number = ? OR lead_number = ? OR CONCAT('LN-', lead_number) = ? OR mobile = ? OR id = ?`,
      [c.loan_id, cleanLoan, c.loan_id, c.phone || '', cleanLoan]
    );
    console.log('leadRows:', leadRows);

    const docs = await query('SELECT * FROM customer_documents WHERE user_id IN (?) OR lead_id IN (?)', [
      ['36'], ['GP-LEAD-36', 'LEAD-209079', 'LN-LEAD-209079']
    ]);
    console.log('docs with array param:', docs.length);
  }
}

test().then(() => process.exit(0)).catch(console.error);
