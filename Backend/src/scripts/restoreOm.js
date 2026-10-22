const { query } = require('../config/db');

async function restoreOmRecords() {
  console.log('[Restore] Ensuring OM KUMAR JHA records exist across tables...');

  // 1. users table
  await query(`
    INSERT INTO users (id, name, first_name, last_name, mobile_number, email, pan_number, aadhaar_number, selfie_url, current_address, monthly_income, employment_type, status)
    VALUES (36, 'OM KUMAR JHA', 'OM KUMAR', 'JHA', '8882746176', 'omk200622@gmail.com', 'DBYPJ6755D', '2424', '/customer_documents/36_selfie_1792693377839.webp', 'C/O Suraj Kumar, Badarpur, South Delhi, Delhi, 110044', 35000, 'Salaried', 'ACTIVE')
    ON DUPLICATE KEY UPDATE 
      name = VALUES(name),
      mobile_number = VALUES(mobile_number),
      selfie_url = VALUES(selfie_url),
      pan_number = VALUES(pan_number),
      aadhaar_number = VALUES(aadhaar_number)
  `);

  // 2. leads table
  await query(`
    INSERT INTO leads (id, user_id, name, mobile, email, lead_number, approved_amount, requested_amount, status)
    VALUES (36, 36, 'OM KUMAR JHA', '8882746176', 'omk200622@gmail.com', 'LEAD-209079', 10000, 10000, 'SENT_TO_COLLECTION_AGENT')
    ON DUPLICATE KEY UPDATE 
      user_id = VALUES(user_id),
      name = VALUES(name),
      mobile = VALUES(mobile),
      lead_number = VALUES(lead_number)
  `);

  // 3. loan_accounts
  await query(`
    INSERT INTO loan_accounts (id, borrower, phone, principal, interest_rate, disbursed_on, outstanding, total_paid, total_repayable, status, assigned_agent)
    VALUES ('LN-LEAD-209079', 'OM KUMAR JHA', '8882746176', 10000, 16.0, '2026-10-23', 0, 26400, 13200, 'Settled', 'Collection Agent')
    ON DUPLICATE KEY UPDATE 
      borrower = VALUES(borrower),
      assigned_agent = VALUES(assigned_agent)
  `);

  // 4. collection_customers
  await query(`
    INSERT INTO collection_customers 
    (id, name, phone, email, address, loan_id, loan_amount, amount_due, emi_amount, due_date, last_payment, status, days_past_due, principal_balance, interest_rate, loan_tenure, remaining_tenure, assigned_agent_code, latitude, longitude)
    VALUES (68, 'OM KUMAR JHA', '8882746176', 'omk200622@gmail.com', 'C/O Suraj Kumar, Badarpur, South Delhi, Delhi, 110044', 'LN-LEAD-209079', 10000, 0, 1667, '2026-11-22', '2026-10-23', 'paid', 0, 10000, 16.0, 30, 30, 'AG001', 28.6139, 77.2090)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      loan_id = VALUES(loan_id),
      assigned_agent_code = 'AG001',
      status = 'paid',
      amount_due = 0
  `);

  // 5. customer_documents
  await query(`
    INSERT INTO customer_documents 
    (id, user_id, lead_id, doc_type, file_name, file_path, uploaded_by, panel_verification_status, tamper_status, tamper_analysis, created_at)
    VALUES 
    (215, 36, 'GP-LEAD-36', 'AADHAAR_PHOTO', '36_aadhaar_photo_1792693241002.jpg', '/customer_documents/36_aadhaar_photo_1792693241002.jpg', 'UIDAI', 'VERIFIED', 'CLEAN', 'Authentic / Original Document on Server', '2026-10-22 23:50:41'),
    (216, 36, 'GP-LEAD-36', 'SELFIE', '36_selfie_1792693377839.webp', '/customer_documents/36_selfie_1792693377839.webp', 'Customer', 'VERIFIED', 'CLEAN', 'Authentic / Original Document on Server', '2026-10-22 23:52:57')
    ON DUPLICATE KEY UPDATE
      user_id = VALUES(user_id),
      file_path = VALUES(file_path),
      panel_verification_status = 'VERIFIED'
  `);

  console.log('[Restore] Successfully ensured all OM KUMAR JHA records!');
}

restoreOmRecords().then(() => process.exit(0)).catch(e => {
  console.error('[Restore Error]:', e);
  process.exit(1);
});
