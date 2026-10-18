// Temporarily break a database privacy projection and require the privacy test to fail.
// Restores source unconditionally. Run only against TEST_DATABASE_URL.
const fs = require("fs"),
  os = require("os"),
  path = require("path"),
  { spawnSync } = require("child_process");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "foundit-mutation-"));
const report = path.join(dir, "report.json");
const file = "db/queries/claims.js";
const original = fs.readFileSync(file, "utf8");
const broken = original.replace(
  "CASE WHEN (${verifier}) THEN c.proof_text END AS proof_text",
  "c.proof_text AS proof_text",
);
if (broken === original) throw new Error("Mutation target was not found.");
try {
  fs.writeFileSync(file, broken);
  const result = spawnSync(
    process.execPath,
    [
      "scripts/test.js",
      "--runTestsByPath",
      "tests/api.test.js",
      "--json",
      "--outputFile",
      report,
    ],
    { stdio: "inherit", env: process.env },
  );
  if (result.status === 0)
    throw new Error("Privacy mutation escaped detection.");
  const failures = JSON.parse(fs.readFileSync(report, "utf8"))
    .testResults.flatMap((r) => r.assertionResults)
    .filter((r) => r.status === "failed");
  if (
    failures.length !== 1 ||
    !failures[0].title.startsWith("only verifier sees")
  )
    throw new Error("Unexpected failures during mutation verification.");
  console.log(
    "Mutation detected: privacy test rejected leaked claimant proof.",
  );
} finally {
  fs.writeFileSync(file, original);
  fs.rmSync(dir, { recursive: true, force: true });
}
