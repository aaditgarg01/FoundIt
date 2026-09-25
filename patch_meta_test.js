const fs = require('fs');
let content = fs.readFileSync('db/scripts/meta_test.js', 'utf8');

// Handle fk_match_band shadowing
const target1 = "      } else if (fails.length === 2 && c.conname === 'ux_one_approved_claim_per_found' && fails.every(f => f.includes('ux_one_approved_claim_per_found'))) {";
const replacement1 = `      } else if (c.conname === 'fk_match_band' && fails.length === 1 && fails[0].includes('ck_match_band_consistent')) {
        console.log(\`✅ \${c.tbl} \${c.conname}: Shadowed by ck_match_band_consistent\`);
        passed++;
` + target1;
content = content.replace(target1, replacement1);

// Handle dropping ux_users_email_lower when testing uq_users_email
const target2 = `      if (c.isIndex) {
         await client.query(c.drop);
      } else {
         await client.query(\`ALTER TABLE \${c.tbl} DROP CONSTRAINT \${c.conname}\`);
      }`;
const replacement2 = target2 + `
      if (c.conname === 'uq_users_email') {
         await client.query('DROP INDEX IF EXISTS ux_users_email_lower');
      }
`;
content = content.replace(target2, replacement2);

const target3 = `      if (c.isIndex) {
         await client.query(c.add);
      } else {
         await client.query(\`ALTER TABLE \${c.tbl} ADD CONSTRAINT \${c.conname} \${c.def}\`);
      }`;
const replacement3 = target3 + `
      if (c.conname === 'uq_users_email') {
         await client.query('CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email))');
      }
`;
content = content.replace(target3, replacement3);

fs.writeFileSync('db/scripts/meta_test.js', content);
