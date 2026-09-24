const { Client } = require('pg');
const { execSync } = require('child_process');

async function runMetaTest() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://foundit_user:foundit_password@localhost:5432/foundit'
  });
  await client.connect();

  let passed = 0;
  let failed = 0;

  try {
    const res = await client.query(`
      SELECT conrelid::regclass::text AS tbl, conname,
             pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
        AND contype IN ('c','u','f')
      ORDER BY conrelid::regclass::text, conname;
    `);

    const constraints = res.rows;
    
    // Add partial indexes manually
    constraints.push({
      tbl: 'users',
      conname: 'ux_users_email_lower',
      isIndex: true,
      drop: 'DROP INDEX ux_users_email_lower',
      add: 'CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email))'
    });
    constraints.push({
      tbl: 'claims',
      conname: 'ux_one_approved_claim_per_found',
      isIndex: true,
      drop: 'DROP INDEX ux_one_approved_claim_per_found',
      add: "CREATE UNIQUE INDEX ux_one_approved_claim_per_found ON claims (found_id) WHERE status IN ('APPROVED', 'COMPLETED')"
    });

    for (const c of constraints) {
      if (c.isIndex) {
         await client.query(c.drop);
      } else {
         await client.query(`ALTER TABLE ${c.tbl} DROP CONSTRAINT ${c.conname}`);
      }

      let out = "";
      try {
        out = execSync('psql -d foundit -f db/tests/negative_tests.sql', { encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        out = err.stderr + err.stdout;
      }
      
      const lines = out.split('\n');
      const fails = lines.filter(l => l.includes('FAIL:'));
      
      if (fails.length === 1 && fails[0].includes(`FAIL: ${c.conname} did not fire`)) {
        console.log(`✅ ${c.tbl} ${c.conname}: Correctly isolated`);
        passed++;
      } else if (fails.length === 2 && c.conname === 'ux_one_approved_claim_per_found' && fails.every(f => f.includes('ux_one_approved_claim_per_found'))) {
        console.log(`✅ ${c.tbl} ${c.conname}: Correctly isolated (2 variants)`);
        passed++;
      } else {
        console.log(`❌ ${c.tbl} ${c.conname}: FAILED. Output fails:`, fails);
        failed++;
      }

      if (c.isIndex) {
         await client.query(c.add);
      } else {
         await client.query(`ALTER TABLE ${c.tbl} ADD CONSTRAINT ${c.conname} ${c.def}`);
      }
    }
    
    console.log(`\nMeta-test Summary: ${passed} passed, ${failed} failed`);

  } catch(err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

runMetaTest();
