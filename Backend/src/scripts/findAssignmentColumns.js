const { pool } = require('../config/db');

async function find() {
  const [tables] = await pool.query('SHOW TABLES');
  const tNames = tables.map(t => Object.values(t)[0]);
  for (const t of tNames) {
    try {
      const [cols] = await pool.query('DESCRIBE ' + t);
      const assignCols = cols.filter(c => c.Field.includes('assign') || c.Field.includes('agent') || c.Field.includes('collector'));
      if (assignCols.length > 0) {
        console.log(t, '->', assignCols.map(c => c.Field).join(', '));
      }
    } catch(e) {}
  }
  process.exit(0);
}

find().catch(err => {
  console.error(err);
  process.exit(1);
});
