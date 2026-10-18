const { pool, refs } = require("./helpers");
const { randomUUID } = require("crypto");
async function fixture(count) {
  const r = await refs();
  const finder = (
    await pool.query(
      "INSERT INTO users(full_name,email,password_hash,role) VALUES('Verifier',$1,'hash','STAFF') RETURNING user_id",
      [randomUUID() + "@test.test"],
    )
  ).rows[0].user_id;
  const f = (
    await pool.query(
      "INSERT INTO found_items(user_id,item_name,category_id,location_id,private_feature,custody,found_date) VALUES($1,'Concurrency bottle',$2,$3,'A private test mark','WITH_FINDER','2026-01-01') RETURNING found_id",
      [finder, r.category_id, r.location_id],
    )
  ).rows[0].found_id;
  const ids = [];
  for (let i = 0; i < count; i++) {
    const u = (
      await pool.query(
        "INSERT INTO users(full_name,email,password_hash) VALUES('Claimant',$1,'hash') RETURNING user_id",
        [randomUUID() + "@test.test"],
      )
    ).rows[0].user_id;
    const l = (
      await pool.query(
        "INSERT INTO lost_items(user_id,item_name,category_id,location_id,lost_date) VALUES($1,'Lost bottle',$2,$3,'2026-01-01') RETURNING lost_id",
        [u, r.category_id, r.location_id],
      )
    ).rows[0].lost_id;
    await pool.query("SELECT generate_matches_for_lost($1)", [l]);
    const m = (
      await pool.query(
        "SELECT match_id FROM matches WHERE lost_id=$1 AND found_id=$2",
        [l, f],
      )
    ).rows[0].match_id;
    const c = await pool.query(
      "INSERT INTO claims(match_id,claimant_id,proof_text) VALUES($1,$2,'A private test mark') RETURNING claim_id",
      [m, u],
    );
    ids.push(c.rows[0].claim_id);
  }
  return { f, finder, ids };
}
afterAll(() => pool.end());
test("50 simultaneous approvals produce exactly one winner and 49 domain conflicts", async () => {
  const { f, finder, ids } = await fixture(50);
  const gate = await pool.connect();
  await gate.query("BEGIN");
  await gate.query(
    "SELECT found_id FROM found_items WHERE found_id=$1 FOR UPDATE",
    [f],
  );
  const promises = ids.map((id) =>
    pool.query("CALL approve_claim($1,$2)", [id, finder]),
  );
  await gate.query("COMMIT");
  gate.release();
  const results = await Promise.allSettled(promises);
  const won = results.filter((x) => x.status === "fulfilled"),
    lost = results.filter((x) => x.status === "rejected");
  expect(won).toHaveLength(1);
  expect(lost).toHaveLength(49);
  expect(lost.every((x) => x.reason.message === "ITEM_NOT_AVAILABLE")).toBe(
    true,
  );
  const rows = (
    await pool.query(
      "SELECT status,count(*)::int AS n FROM claims WHERE found_id=$1 GROUP BY status",
      [f],
    )
  ).rows;
  expect(rows).toEqual(
    expect.arrayContaining([
      { status: "APPROVED", n: 1 },
      { status: "REJECTED", n: 49 },
    ]),
  );
  const flags = (
    await pool.query(
      "SELECT sum(u.flagged_count)::int AS n FROM users u JOIN claims c ON c.claimant_id=u.user_id WHERE c.found_id=$1",
      [f],
    )
  ).rows[0].n;
  expect(flags).toBe(0);
  const audits = await pool.query(
    "SELECT count(*)::int AS n FROM audit_log WHERE entity_type='CLAIM' AND entity_id=ANY($1::int[]) AND new_status IN ('APPROVED','REJECTED')",
    [ids],
  );
  expect(audits.rows[0].n).toBe(50);
  console.log(
    "50-way approval: 1 approved, 49 ITEM_NOT_AVAILABLE, 49 systemic rejections, 0 claimant penalties, 50 decision audit rows.",
  );
});
test("unique index still prevents two approvals when locking procedure is bypassed", async () => {
  const { ids, finder } = await fixture(2);
  const results = await Promise.allSettled(
    ids.map((id) =>
      pool.query(
        "UPDATE claims SET status='APPROVED',verifier_id=$2,decided_at=NOW() WHERE claim_id=$1",
        [id, finder],
      ),
    ),
  );
  expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  const fail = results.find((x) => x.status === "rejected");
  expect(fail.reason.code).toBe("23505");
  expect(fail.reason.constraint).toBe("ux_one_approved_claim_per_found");
  console.log(
    "Backstop without procedure locks: second approval rejected by ux_one_approved_claim_per_found (23505).",
  );
});
