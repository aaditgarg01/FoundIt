require("dotenv").config({ quiet: true });
const { Pool } = require("pg");
const { spawnSync } = require("child_process");
async function main() {
  if (!process.env.TEST_DATABASE_URL)
    throw new Error(
      "Set TEST_DATABASE_URL to a dedicated migrated and reference-seeded test database.",
    );
  const u = new URL(process.env.TEST_DATABASE_URL);
  if (!u.pathname.endsWith("_test"))
    throw new Error("Test database name must end with _test.");
  const env = {
    ...process.env,
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    MIGRATION_DATABASE_URL: process.env.TEST_DATABASE_URL,
    NODE_ENV: "test",
  };
  for (const [bin, args] of [
    [process.execPath, ["scripts/migrate.js"]],
    [process.execPath, ["db/scripts/seed_reference.js"]],
    [
      process.execPath,
      [
        "node_modules/jest/bin/jest.js",
        "--runInBand",
        ...process.argv.slice(2),
      ],
    ],
  ]) {
    const p = spawnSync(bin, args, { stdio: "inherit", env });
    if (p.status) {
      process.exitCode = p.status || 1;
      return;
    }
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
