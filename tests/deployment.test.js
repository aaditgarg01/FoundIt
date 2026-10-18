const request = require("supertest");
const app = require("../api");
const { pool } = require("../src/db");
const { spawnSync } = require("node:child_process");
afterAll(() => pool.end());
test("Vercel adapter preserves API paths and database-backed health", async () => {
  const response = await request(app).get("/api/v1/health");
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: "ok", db: true });
  expect(response.headers["cache-control"]).toBe("private, no-store");
});
test("Vercel adapter preserves JSON errors for unknown API endpoints", async () => {
  const response = await request(app).get("/api/v1/not-an-endpoint");
  expect(response.status).toBe(404);
  expect(response.headers["content-type"]).toContain("application/json");
});
test("deployment build refuses missing database configuration", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/prepare-deployment.js"],
    {
      env: { ...process.env, DATABASE_URL: "", JWT_SECRET: "" },
      encoding: "utf8",
    },
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Set DATABASE_URL");
});
test("deployment build refuses an insecure signing secret", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/prepare-deployment.js"],
    { env: { ...process.env, JWT_SECRET: "short" }, encoding: "utf8" },
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Set JWT_SECRET");
});
