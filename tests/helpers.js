const request = require("supertest");
const app = require("../src/app");
const { pool } = require("../src/db");
const { randomUUID } = require("crypto");
async function user(role = "STUDENT") {
  const email = `${randomUUID()}@foundit.test`,
    password = "TestPassword123!";
  const r = await request(app)
    .post("/api/v1/auth/register")
    .send({ email, password, full_name: "Test Person" });
  if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  if (role !== "STUDENT")
    await pool.query("UPDATE users SET role=$1 WHERE user_id=$2", [
      role,
      r.body.user.user_id,
    ]);
  const login = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });
  if (login.status !== 200) throw new Error(JSON.stringify(login.body));
  return { ...login.body, userId: r.body.user.user_id, email, password };
}
const auth = (method, url, u, body) =>
  request(app)
    [method]("/api/v1" + url)
    .set("Authorization", "Bearer " + u.token)
    .send(body);
async function refs() {
  const { rows } = await pool.query(
    `SELECT (SELECT category_id FROM categories WHERE category_name='Water Bottle') AS category_id,(SELECT location_id FROM locations ORDER BY location_id LIMIT 1) AS location_id,(SELECT brand_id FROM brands WHERE brand_name='Milton') AS brand_id,(SELECT colour_id FROM colours WHERE colour_name='Blue') AS colour_id`,
  );
  return rows[0];
}
async function pair(owner, finder, extra = {}) {
  const base = {
    ...(await refs()),
    item_name: "Blue steel water bottle",
    description: "Blue steel campus bottle",
    lost_date: "2026-01-01",
  };
  const foundBody = {
    ...base,
    found_date: "2026-01-01",
    private_feature: "A tiny turtle engraved on the base",
    custody: "WITH_FINDER",
    ...extra,
  };
  delete foundBody.lost_date;
  const found = await auth("post", "/items/found", finder, foundBody);
  if (found.status !== 201) throw new Error(JSON.stringify(found.body));
  const lost = await auth("post", "/items/lost", owner, base);
  if (lost.status !== 201) throw new Error(JSON.stringify(lost.body));
  const matches = await auth(
    "get",
    "/matches/lost/" + lost.body.lost_id,
    owner,
  );
  const match = matches.body.matches.find(
    (m) => m.found_id === found.body.found_id,
  );
  if (!match) throw new Error("No match generated");
  return {
    found_id: found.body.found_id,
    lost_id: lost.body.lost_id,
    match_id: match.match_id,
  };
}
module.exports = { app, pool, user, auth, refs, pair };
