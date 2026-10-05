const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db');

describe('Concurrency Proof: approve_claim', () => {
  let user1, user2, user3;
  let token1, token2, token3;
  let match_id, found_id;
  let claim1, claim2;

  beforeAll(async () => {
    // We assume the db is seeded with categories, locations etc.
    // Let's create some users
    const u1 = await pool.query("INSERT INTO users (email, password_hash, display_name) VALUES ('user1_conc@test.com', 'hash', 'User 1') RETURNING user_id");
    user1 = u1.rows[0].user_id;
    const u2 = await pool.query("INSERT INTO users (email, password_hash, display_name) VALUES ('user2_conc@test.com', 'hash', 'User 2') RETURNING user_id");
    user2 = u2.rows[0].user_id;
    const u3 = await pool.query("INSERT INTO users (email, password_hash, display_name, role) VALUES ('staff_conc@test.com', 'hash', 'Staff', 'STAFF') RETURNING user_id");
    user3 = u3.rows[0].user_id; // Verifier

    // We can simulate tokens with a simple helper or just use the DB directly for the concurrency proof.
    // The requirement is to test the DB transaction. Let's test it at the DB level, and also we can test the API.
    // Actually, TRD 10.2 lock order is about `approve_claim(claim_id, verifier_id)`.
    // Let's create the items:
    const loc = await pool.query("INSERT INTO locations (name, building, geometry) VALUES ('Conc Loc', 'Conc Bldg', ST_GeomFromText('POINT(0 0)')) RETURNING location_id");
    const loc_id = loc.rows[0].location_id;
    
    // Found item by user1
    const found = await pool.query("INSERT INTO found_items (category_id, location_id, user_id, found_date, description, status) VALUES (1, $1, $2, '2026-01-01', 'Found Item Conc', 'AVAILABLE') RETURNING found_id", [loc_id, user1]);
    found_id = found.rows[0].found_id;

    // Lost item by user2
    const lost = await pool.query("INSERT INTO lost_items (category_id, location_id, user_id, lost_date, description, status) VALUES (1, $1, $2, '2026-01-01', 'Lost Item Conc', 'OPEN') RETURNING lost_id", [loc_id, user2]);
    const lost_id = lost.rows[0].lost_id;

    // Match
    const match = await pool.query("INSERT INTO matches (lost_id, found_id, score, band, status) VALUES ($1, $2, 100, 'HIGH', 'SUGGESTED') RETURNING match_id", [lost_id, found_id]);
    match_id = match.rows[0].match_id;

    // Claims: Let's manually insert two pending claims for the same found_id (e.g. from two different matches, but here we just need two claims on the same found item).
    // Let's create another lost item and match for the same found item so there are two competing claims.
    const lost2 = await pool.query("INSERT INTO lost_items (category_id, location_id, user_id, lost_date, description, status) VALUES (1, $1, $2, '2026-01-01', 'Lost Item 2 Conc', 'OPEN') RETURNING lost_id", [loc_id, user2]);
    const match2 = await pool.query("INSERT INTO matches (lost_id, found_id, score, band, status) VALUES ($1, $2, 100, 'HIGH', 'SUGGESTED') RETURNING match_id", [lost2.rows[0].lost_id, found_id]);

    const c1 = await pool.query("INSERT INTO claims (match_id, claimant_id, proof_text, status, found_id) VALUES ($1, $2, 'Proof 1', 'PENDING', $3) RETURNING claim_id", [match_id, user2, found_id]);
    claim1 = c1.rows[0].claim_id;

    const c2 = await pool.query("INSERT INTO claims (match_id, claimant_id, proof_text, status, found_id) VALUES ($1, $2, 'Proof 2', 'PENDING', $3) RETURNING claim_id", [match2.rows[0].match_id, user2, found_id]);
    claim2 = c2.rows[0].claim_id;
  });

  afterAll(async () => {
    await pool.end();
  });

  test('approving two claims on the same found item concurrently should result in one success and one failure', async () => {
    const run1 = pool.query("CALL approve_claim($1, $2)", [claim1, user3]);
    const run2 = pool.query("CALL approve_claim($1, $2)", [claim2, user3]);

    const results = await Promise.allSettled([run1, run2]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    
    // The rejected one should be because the ITEM_NOT_AVAILABLE
    expect(rejected[0].reason.message).toContain('ITEM_NOT_AVAILABLE');

    // Check DB state
    const c1State = await pool.query("SELECT status FROM claims WHERE claim_id = $1", [claim1]);
    const c2State = await pool.query("SELECT status FROM claims WHERE claim_id = $2", [claim2]);

    const states = [c1State.rows[0].status, c2State.rows[0].status];
    expect(states).toContain('APPROVED');
    // Step 7 rejects other pending claims
    expect(states).toContain('REJECTED');

    const fState = await pool.query("SELECT status FROM found_items WHERE found_id = $1", [found_id]);
    expect(fState.rows[0].status).toBe('CLAIMED');
  });
});
