require('dotenv').config({ path: '.env' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    let md = '# FoundIt Database Design\n\n## Data Dictionary\n\n';

    // Get tables
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'pgmigrations'
      ORDER BY table_name
    `);

    for (const t of tablesRes.rows) {
      const tbl = t.table_name;
      md += `### ${tbl}\n\n`;
      md += `| Column | Type | Nullable | Default |\n`;
      md += `|---|---|---|---|\n`;

      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tbl]);

      for (const c of cols.rows) {
        md += `| ${c.column_name} | ${c.data_type} | ${c.is_nullable} | ${c.column_default || ''} |\n`;
      }
      md += '\n';
    }

    md += '## Referential Policy\n\n';
    md += '| Constraint Name | Table | Foreign Key | References | On Update | On Delete |\n';
    md += '|---|---|---|---|---|---|\n';

    const fks = await client.query(`
      SELECT
        c.conname AS constraint_name,
        cl.relname AS table_name,
        a.attname AS foreign_key,
        clf.relname AS references_table,
        CASE c.confupdtype
          WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE c.confupdtype::text END AS on_update,
        CASE c.confdeltype
          WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE c.confdeltype::text END AS on_delete
      FROM pg_constraint c
      JOIN pg_class cl ON c.conrelid = cl.oid
      JOIN pg_class clf ON c.confrelid = clf.oid
      JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(c.conkey)
      WHERE c.contype = 'f' AND cl.relnamespace = 'public'::regnamespace
      ORDER BY cl.relname, c.conname
    `);

    for (const fk of fks.rows) {
      md += `| ${fk.constraint_name} | ${fk.table_name} | ${fk.foreign_key} | ${fk.references_table} | ${fk.on_update} | ${fk.on_delete} |\n`;
    }

    fs.writeFileSync(path.join(__dirname, '../../docs/FoundIt_Database_Design.md'), md);
    console.log('Successfully generated docs/FoundIt_Database_Design.md');

  } finally {
    await client.end();
  }
}

run().catch(console.error);
