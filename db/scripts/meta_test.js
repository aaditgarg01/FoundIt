const { Client } = require('pg');
const { execSync } = require('child_process');

async function runMetaTest() {
  const DB = process.env.DATABASE_URL || 'postgres://foundit_user:foundit_password@localhost:5432/foundit';
  const client = new Client({
    connectionString: DB
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
      if (c.conname === 'uq_users_email') {
         await client.query('DROP INDEX IF EXISTS ux_users_email_lower');
      }


      let out = "";
      try {
        out = execSync(`psql "${DB}" -f db/tests/negative_tests.sql 2>&1`, { encoding: 'utf8', stdio: 'pipe' });
      } catch (err) {
        out = err.stderr + err.stdout;
      }
      
      const lines = out.split('\n');
      const fails = lines.filter(l => l.includes('FAIL:'));
      
      if (c.conname === 'uq_users_email' && fails.length === 2 && fails.some(f => f.includes('uq_users_email')) && fails.some(f => f.includes('ux_users_email_lower'))) {
        console.log(`✅ ${c.tbl} ${c.conname}: Correctly isolated (with shadow hack)`);
        passed++;
      } else if (fails.length === 1 && fails[0].includes(`FAIL: ${c.conname} did not fire`)) {
        console.log(`✅ ${c.tbl} ${c.conname}: Correctly isolated`);
        passed++;
      } else if (c.conname === 'fk_match_band' && fails.length === 1 && fails[0].includes('ck_match_band_consistent')) {
        console.log(`✅ ${c.tbl} ${c.conname}: Shadowed by ck_match_band_consistent`);
        passed++;
      } else if (fails.length === 2 && c.conname === 'ux_one_approved_claim_per_found' && fails.every(f => f.includes('ux_one_approved_claim_per_found'))) {
        // ux_one_approved_claim_per_found has two assertions (APPROVED and COMPLETED),
        // so dropping it produces two failures.
        console.log(`✅ ${c.tbl} ${c.conname}: Correctly isolated (2 variants)`);
        passed++;
      } else {
        console.log(`❌ ${c.tbl} ${c.conname}: FAILED. Output fails:`, fails);
        console.log(`FULL OUTPUT: ${out}`);
        failed++;
      }

      if (c.isIndex) {
         await client.query(c.add);
      } else {
         await client.query(`ALTER TABLE ${c.tbl} ADD CONSTRAINT ${c.conname} ${c.def}`);
      }
      if (c.conname === 'uq_users_email') {
         await client.query('CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email))');
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
