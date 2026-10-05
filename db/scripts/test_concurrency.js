const { pool } = require('../../src/db');

async function run() {
  let claim1, claim2, user3, found_id;
  try {
    const loc = await pool.query("INSERT INTO locations (location_name, building) VALUES ('Conc Loc', 'Conc Bldg') RETURNING location_id");
    const loc_id = loc.rows[0].location_id;
    const u1 = await pool.query("INSERT INTO users (email, password_hash, display_name) VALUES ('user1_' || gen_random_uuid() || '@test.com', 'hash', 'User 1') RETURNING user_id");
    const user1 = u1.rows[0].user_id;
    const u2 = await pool.query("INSERT INTO users (email, password_hash, display_name) VALUES ('user2_' || gen_random_uuid() || '@test.com', 'hash', 'User 2') RETURNING user_id");
    const user2 = u2.rows[0].user_id;
    const u3 = await pool.query("INSERT INTO users (email, password_hash, display_name, role) VALUES ('staff_' || gen_random_uuid() || '@test.com', 'hash', 'Staff', 'STAFF') RETURNING user_id");
    user3 = u3.rows[0].user_id;

    const found = await pool.query("INSERT INTO found_items (category_id, location_id, user_id, found_date, description, status) VALUES (1, $1, $2, '2026-01-01', 'Found Item Conc', 'AVAILABLE') RETURNING found_id", [loc_id, user1]);
    found_id = found.rows[0].found_id;
    const lost1 = await pool.query("INSERT INTO lost_items (category_id, location_id, user_id, lost_date, description, status) VALUES (1, $1, $2, '2026-01-01', 'Lost Item 1', 'OPEN') RETURNING lost_id", [loc_id, user2]);
    const lost2 = await pool.query("INSERT INTO lost_items (category_id, location_id, user_id, lost_date, description, status) VALUES (1, $1, $2, '2026-01-01', 'Lost Item 2', 'OPEN') RETURNING lost_id", [loc_id, user2]);
    const match1 = await pool.query("INSERT INTO matches (lost_id, found_id, score, band, status) VALUES ($1, $2, 100, 'HIGH', 'SUGGESTED') RETURNING match_id", [lost1.rows[0].lost_id, found_id]);
    const match2 = await pool.query("INSERT INTO matches (lost_id, found_id, score, band, status) VALUES ($1, $2, 100, 'HIGH', 'SUGGESTED') RETURNING match_id", [lost2.rows[0].lost_id, found_id]);

    const c1 = await pool.query("INSERT INTO claims (match_id, claimant_id, proof_text, status) VALUES ($1, $2, 'Proof 1', 'PENDING') RETURNING claim_id", [match1.rows[0].match_id, user2]);
    claim1 = c1.rows[0].claim_id;
    const c2 = await pool.query("INSERT INTO claims (match_id, claimant_id, proof_text, status) VALUES ($1, $2, 'Proof 2', 'PENDING') RETURNING claim_id", [match2.rows[0].match_id, user2]);
    claim2 = c2.rows[0].claim_id;

    console.log("Starting concurrent approve_claim...");
    const p1 = pool.query("CALL approve_claim($1, $2)", [claim1, user3]);
    const p2 = pool.query("CALL approve_claim($1, $2)", [claim2, user3]);

    const res = await Promise.allSettled([p1, p2]);
    console.log(res);

    const states = await pool.query("SELECT claim_id, status FROM claims WHERE claim_id IN ($1, $2)", [claim1, claim2]);
    console.log("Claims states:", states.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
