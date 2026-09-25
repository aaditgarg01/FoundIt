const { execSync } = require('child_process');
const DB = process.env.DATABASE_URL || 'postgres://foundit_user:foundit_password@127.0.0.1:5432/foundit';

let out = "";
try {
  out = execSync(`psql "${DB}" -c "ALTER TABLE users DROP CONSTRAINT ck_users_email_format"`, { encoding: 'utf8', stdio: 'pipe' });
  out = execSync(`psql "${DB}" -f db/tests/negative_tests.sql`, { encoding: 'utf8', stdio: 'pipe' });
} catch (err) {
  out = (err.stderr || "") + (err.stdout || "");
}
console.log("OUT:");
console.log(out);
execSync(`psql "${DB}" -c "ALTER TABLE users ADD CONSTRAINT ck_users_email_format CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$')"`, { encoding: 'utf8', stdio: 'pipe' });
