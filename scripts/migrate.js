require("dotenv").config({ quiet: true });
const { runner } = require("node-pg-migrate");
runner({
  databaseUrl: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL,
  dir: "db/migrations",
  direction: "up",
  migrationsTable: "pgmigrations",
  log: () => {},
})
  .then((applied) => {
    for (const migration of applied) console.log("Applied: " + migration.name);
    console.log(`Migrations complete: ${applied.length} applied.`);
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
