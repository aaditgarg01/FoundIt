// Vercel builds apply forward migrations and reference data, never demo accounts.
require("dotenv").config({ quiet: true });
const { spawnSync } = require("node:child_process");
if (!process.env.DATABASE_URL) {
  console.error(
    "Set DATABASE_URL to a hosted PostgreSQL connection before deploying.",
  );
  process.exit(1);
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error(
    "Set JWT_SECRET to at least 32 random characters before deploying.",
  );
  process.exit(1);
}
for (const script of ["scripts/migrate.js", "db/scripts/seed_reference.js"]) {
  const result = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
