const request = require("supertest");
const { app, pool, user, auth, refs, pair } = require("./helpers");
let owner, finder, stranger, staff, admin, p, claim;
beforeAll(async () => {
  owner = await user();
  finder = await user();
  stranger = await user();
  staff = await user("STAFF");
  admin = await user("ADMIN");
});
afterAll(() => pool.end());
test("health reports a working database", async () => {
  const r = await request(app).get("/api/v1/health");
  expect(r.body).toEqual({ status: "ok", db: true });
});
test("registration never permits privilege escalation", async () => {
  const r = await request(app).post("/api/v1/auth/register").send({
    email: "bad@foundit.test",
    password: "Password123",
    full_name: "Bad",
    role: "ADMIN",
  });
  expect(r.status).toBe(400);
});
test.each([{ password: "x" }, { email: "bad" }, { full_name: "" }])(
  "registration validates %j",
  async (invalid) => {
    const r = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "valid@foundit.test",
        password: "Password123",
        full_name: "Valid",
        ...invalid,
      });
    expect(r.status).toBe(400);
  },
);
test("case insensitive duplicate email is a conflict", async () => {
  const r = await request(app).post("/api/v1/auth/register").send({
    email: owner.email.toUpperCase(),
    password: owner.password,
    full_name: "Duplicate",
  });
  expect(r.status).toBe(409);
});
test("invalid login is rejected", async () => {
  const r = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: owner.email, password: "wrong" });
  expect(r.status).toBe(401);
});
test("protected routes require a session", async () => {
  expect((await request(app).get("/api/v1/items/found")).status).toBe(401);
});
test("refresh uses the actual session schema and revocation invalidates JWT", async () => {
  const u = await user();
  const refresh = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken: u.refreshToken });
  expect(refresh.status).toBe(200);
  expect((await auth("post", "/auth/logout", u, {})).status).toBe(200);
  expect((await auth("get", "/auth/me", u)).status).toBe(401);
  expect(
    (
      await request(app)
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: u.refreshToken })
    ).status,
  ).toBe(401);
});
test("deactivation invalidates an existing JWT", async () => {
  const u = await user();
  await pool.query("UPDATE users SET is_active=false WHERE user_id=$1", [
    u.userId,
  ]);
  expect((await auth("get", "/auth/me", u)).status).toBe(401);
});
test("role changes are read from database rather than trusted JWT claims", async () => {
  const u = await user("STAFF");
  await pool.query("UPDATE users SET role='STUDENT' WHERE user_id=$1", [
    u.userId,
  ]);
  expect((await auth("get", "/dashboard/analytics", u)).status).toBe(403);
});
test("profile update is audited", async () => {
  const r = await auth("patch", "/auth/me", owner, {
    full_name: "Updated Name",
    phone: "12345",
    department: "CSE",
  });
  expect(r.status).toBe(200);
  const a = await pool.query(
    "SELECT 1 FROM audit_log WHERE entity_type='USER' AND entity_id=$1 AND action='UPDATED'",
    [owner.userId],
  );
  expect(a.rowCount).toBe(1);
});
test("report creation generates matching rows with reasons that sum", async () => {
  p = await pair(owner, finder);
  const r = await auth("get", "/matches/" + p.match_id, owner);
  expect(r.status).toBe(200);
  expect(r.body.reason_json.total).toBe(r.body.match_score);
  expect(r.body.reason_json.components.reduce((a, c) => a + c.points, 0)).toBe(
    r.body.match_score,
  );
  expect(r.body.match_score).toBe(100);
});
test("matching is idempotent and weights are read from configuration", async () => {
  await pool.query("SELECT generate_matches_for_lost($1)", [p.lost_id]);
  const r = await pool.query(
    "SELECT count(*)::int AS n FROM matches WHERE lost_id=$1 AND found_id=$2",
    [p.lost_id, p.found_id],
  );
  expect(r.rows[0].n).toBe(1);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      "UPDATE match_config SET config_value=0 WHERE config_key='W_BRAND'",
    );
    await c.query("SELECT generate_matches_for_lost($1)", [p.lost_id]);
    const m = await c.query(
      "SELECT match_score FROM matches WHERE match_id=$1",
      [p.match_id],
    );
    expect(m.rows[0].match_score).toBe(80);
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
});
test("same finder and owner are excluded from matching", async () => {
  const r = await auth("post", "/items/lost", finder, {
    ...(await refs()),
    item_name: "Bottle",
    lost_date: "2026-01-01",
  });
  expect(r.status).toBe(201);
  const m = await pool.query(
    "SELECT 1 FROM matches WHERE lost_id=$1 AND found_id=$2",
    [r.body.lost_id, p.found_id],
  );
  expect(m.rowCount).toBe(0);
});
test("reverse matching finds an earlier lost report", async () => {
  const lost = await auth("post", "/items/lost", stranger, {
    ...(await refs()),
    item_name: "Bottle reverse",
    lost_date: "2026-01-01",
  });
  const found = await auth("post", "/items/found", finder, {
    ...(await refs()),
    item_name: "Bottle reverse",
    found_date: "2026-01-01",
    private_feature: "Unique reverse detail",
    custody: "WITH_FINDER",
  });
  expect(found.status).toBe(201);
  const m = await pool.query(
    "SELECT 1 FROM matches WHERE lost_id=$1 AND found_id=$2",
    [lost.body.lost_id, found.body.found_id],
  );
  expect(m.rowCount).toBe(1);
});
test.each([
  { limit: -1 },
  { limit: 51 },
  { offset: -1 },
  { sort: "created_at; DROP TABLE users" },
  { category_id: "bad" },
  { date_from: "2026-02-31" },
])("browse rejects invalid query %j", async (q) => {
  const r = await auth("get", "/items/found?" + new URLSearchParams(q), owner);
  expect(r.status).toBe(400);
});
test("search uses generated search_vector and exposes no private fields", async () => {
  const r = await auth("get", "/items/found?q=bottle", owner);
  expect(r.status).toBe(200);
  expect(r.body.items.length).toBeGreaterThan(0);
  for (const i of r.body.items)
    for (const k of [
      "private_feature",
      "storage_location",
      "user_id",
      "finder_note",
      "search_vector",
    ])
      expect(i).not.toHaveProperty(k);
});
test("pagination preserves the count on an empty page", async () => {
  const r = await auth("get", "/items/found?offset=10000", owner);
  expect(r.body.items).toEqual([]);
  expect(r.body.total).toBeGreaterThan(0);
});
test("sensitive documents suppress their public name and description", async () => {
  const c = (
    await pool.query(
      "SELECT category_id FROM categories WHERE category_name='Identity Document'",
    )
  ).rows[0].category_id;
  const r = await auth("post", "/items/found", finder, {
    ...(await refs()),
    category_id: c,
    item_name: "Secret Student Name",
    description: "Sensitive registration number",
    private_feature: "Secret back detail",
    found_date: "2026-01-01",
    custody: "WITH_FINDER",
  });
  expect(r.status).toBe(201);
  const publicItem = await auth(
    "get",
    "/items/found/" + r.body.found_id,
    owner,
  );
  expect(publicItem.body.item_name).toBe("Identity Document");
  expect(publicItem.body.description).toBeNull();
});
test.each([
  { found_date: "2099-01-01" },
  { private_feature: "" },
  { private_feature: "secret", description: "Here is SECRET" },
  { custody: "DEPOSITED_SECURITY", storage_location: "" },
  { category_id: 99999999 },
])("found report handles invalid data %j", async (invalid) => {
  const r = await auth("post", "/items/found", finder, {
    ...(await refs()),
    item_name: "Bottle",
    found_date: "2026-01-01",
    private_feature: "private detail",
    custody: "WITH_FINDER",
    ...invalid,
  });
  expect(r.status).toBe(400);
});
test("another user cannot access the report or match", async () => {
  expect(
    (await auth("get", "/items/mine/lost/" + p.lost_id, stranger)).status,
  ).toBe(404);
  expect((await auth("get", "/matches/" + p.match_id, stranger)).status).toBe(
    404,
  );
  expect(
    (
      await auth("post", "/claims", stranger, {
        match_id: p.match_id,
        proof_text: "A tiny turtle engraved on the base",
      })
    ).status,
  ).toBe(404);
});
test("dismissal persists through recomputation and supports undo", async () => {
  expect(
    (await auth("post", "/matches/" + p.match_id + "/dismiss", owner)).status,
  ).toBe(200);
  await pool.query("SELECT generate_matches_for_lost($1)", [p.lost_id]);
  expect(
    (
      await pool.query("SELECT status FROM matches WHERE match_id=$1", [
        p.match_id,
      ])
    ).rows[0].status,
  ).toBe("REJECTED_BY_USER");
  expect(
    (await auth("post", "/matches/" + p.match_id + "/restore", owner)).status,
  ).toBe(200);
});
test("claim requires sufficient proof", async () => {
  expect(
    (
      await auth("post", "/claims", owner, {
        match_id: p.match_id,
        proof_text: "mine",
      })
    ).status,
  ).toBe(400);
});
test("claim creation is atomic and duplicate pending claims fail", async () => {
  const r = await auth("post", "/claims", owner, {
    match_id: p.match_id,
    proof_text: "A tiny turtle engraved on the base",
  });
  expect(r.status).toBe(201);
  claim = r.body.claim_id;
  expect(
    (
      await auth("post", "/claims", owner, {
        match_id: p.match_id,
        proof_text: "Repeated proof for the same item",
      })
    ).status,
  ).toBe(409);
});
test("only verifier sees proof/private feature and no contact before approval", async () => {
  const own = await auth("get", "/claims/" + claim, owner);
  expect(own.body.private_feature).toBeNull();
  expect(own.body.proof_text).toBeNull();
  expect(own.body.finder_contact).toBeNull();
  const f = await auth("get", "/claims/" + claim, finder);
  expect(f.body.private_feature).toBe("A tiny turtle engraved on the base");
  expect(f.body.proof_text).toBe("A tiny turtle engraved on the base");
  expect(f.body.claimant_contact).toBeNull();
  expect((await auth("get", "/claims/" + claim, stranger)).status).toBe(404);
});
test.each(["approve", "reject", "handover"])(
  "unrelated user cannot %s",
  async (action) => {
    expect(
      (await auth("post", `/claims/${claim}/${action}`, stranger, {})).status,
    ).toBe(404);
  },
);
test("self approval is rejected", async () => {
  expect(
    (await auth("post", `/claims/${claim}/approve`, owner, {})).status,
  ).toBe(404);
});
test("claim listing works for owner and finder", async () => {
  for (const u of [owner, finder]) {
    const r = await auth("get", "/claims", u);
    expect(r.status).toBe(200);
    expect(r.body.claims.some((c) => c.claim_id === claim)).toBe(true);
  }
});
test("finder approves ordinary item and contacts become visible", async () => {
  const r = await auth("post", `/claims/${claim}/approve`, finder, {});
  expect(r.status).toBe(200);
  const d = await auth("get", "/claims/" + claim, owner);
  expect(d.body.status).toBe("APPROVED");
  expect(d.body.finder_contact.email).toBe(finder.email);
});
test("handover writes required timestamps and timeline, rejects repeat", async () => {
  const r = await auth("post", `/claims/${claim}/handover`, owner, {});
  expect(r.status).toBe(200);
  const f = (
    await pool.query(
      "SELECT status,returned_at FROM found_items WHERE found_id=$1",
      [p.found_id],
    )
  ).rows[0];
  const l = (
    await pool.query(
      "SELECT status,resolved_at FROM lost_items WHERE lost_id=$1",
      [p.lost_id],
    )
  ).rows[0];
  expect(f.status).toBe("RETURNED");
  expect(f.returned_at).toBeTruthy();
  expect(l.status).toBe("RESOLVED");
  expect(l.resolved_at).toBeTruthy();
  expect(
    (await auth("post", `/claims/${claim}/handover`, owner, {})).status,
  ).toBe(409);
  const t = await auth("get", "/claims/timeline/" + claim, owner);
  expect(t.status).toBe(200);
  expect(t.body.timeline.length).toBeGreaterThanOrEqual(9);
  expect(t.body.timeline.every((x) => x.changed_at)).toBe(true);
  expect(
    (await auth("get", "/claims/timeline/" + claim, stranger)).status,
  ).toBe(404);
});
test("high value finder cannot verify but staff can", async () => {
  const q = await pair(owner, finder, { is_high_value: true });
  const c = await auth("post", "/claims", owner, {
    match_id: q.match_id,
    proof_text: "The private detail is a turtle engraving",
  });
  expect(c.status).toBe(201);
  expect(
    (await auth("post", `/claims/${c.body.claim_id}/approve`, finder, {}))
      .status,
  ).toBe(404);
  expect(
    (await auth("get", "/claims/" + c.body.claim_id, finder)).body
      .private_feature,
  ).toBeNull();
  expect(
    (await auth("post", `/claims/${c.body.claim_id}/approve`, staff, {}))
      .status,
  ).toBe(200);
});
test("withdrawal invalidates matches and blocks further claims", async () => {
  const l = await auth("post", "/items/lost", owner, {
    ...(await refs()),
    item_name: "To withdraw",
    lost_date: "2026-01-01",
  });
  expect(
    (await auth("post", `/items/lost/${l.body.lost_id}/withdraw`, stranger, {}))
      .status,
  ).toBe(404);
  expect(
    (await auth("post", `/items/lost/${l.body.lost_id}/withdraw`, owner, {}))
      .status,
  ).toBe(200);
  const m = await pool.query(
    "SELECT 1 FROM matches WHERE lost_id=$1 AND status='SUGGESTED'",
    [l.body.lost_id],
  );
  expect(m.rowCount).toBe(0);
});
test("reference administration checks role and supports deactivation", async () => {
  expect(
    (
      await auth("post", "/reference/brands", owner, {
        brand_name: "Disallowed",
      })
    ).status,
  ).toBe(403);
  const r = await auth("post", "/reference/brands", admin, {
    brand_name: "TestBrand" + Date.now(),
  });
  expect(r.status).toBe(201);
  expect(
    (
      await auth("patch", "/reference/brands/" + r.body.brand_id, admin, {
        is_active: false,
      })
    ).body.is_active,
  ).toBe(false);
  expect(
    (await auth("post", "/reference/users", admin, { email: "x" })).status,
  ).toBe(404);
});
test("analytics available to staff only", async () => {
  expect((await auth("get", "/dashboard/analytics", owner)).status).toBe(403);
  const r = await auth("get", "/dashboard/analytics", staff);
  expect(r.status).toBe(200);
  expect(r.body.returned).toBeGreaterThan(0);
});
test("audit immutability and transaction rollback", async () => {
  await expect(pool.query("UPDATE audit_log SET detail=NULL")).rejects.toThrow(
    "append-only",
  );
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await c.query(
      "INSERT INTO lost_items(user_id,item_name,category_id,location_id,lost_date) VALUES($1,'Rollback item',$2,$3,'2026-01-01') RETURNING lost_id",
      [owner.userId, (await refs()).category_id, (await refs()).location_id],
    );
    await c.query("ROLLBACK");
    expect(
      (
        await pool.query(
          "SELECT 1 FROM audit_log WHERE entity_type='LOST_ITEM' AND entity_id=$1",
          [r.rows[0].lost_id],
        )
      ).rowCount,
    ).toBe(0);
  } finally {
    c.release();
  }
});
test("audit reconstruction agrees with all current lifecycle states", async () => {
  const r = await pool.query(
    `WITH entities AS(SELECT 'LOST_ITEM'::audit_entity AS entity_type,lost_id AS entity_id,status::text FROM lost_items UNION ALL SELECT 'FOUND_ITEM'::audit_entity,found_id,status::text FROM found_items UNION ALL SELECT 'CLAIM'::audit_entity,claim_id,status::text FROM claims) SELECT e.* FROM entities e LEFT JOIN LATERAL(SELECT new_status FROM audit_log a WHERE a.entity_type=e.entity_type AND a.entity_id=e.entity_id AND a.new_status IS NOT NULL ORDER BY a.changed_at DESC,a.audit_id DESC LIMIT 1)a ON true WHERE a.new_status IS DISTINCT FROM e.status`,
  );
  expect(r.rows).toEqual([]);
});
test("scoring settings reject non-admin and invalid weight totals", async () => {
  expect((await auth("get", "/config", owner)).status).toBe(403);
  expect((await auth("patch", "/config", admin, { W_BRAND: 99 })).status).toBe(
    400,
  );
  expect((await auth("patch", "/config", admin, { T_FLOOR: 99 })).status).toBe(
    400,
  );
  const r = await auth("patch", "/config", admin, { T_FLOOR: 40 });
  expect(r.status).toBe(200);
  const d = await auth("get", "/config", admin);
  expect(d.status).toBe(200);
  expect(
    d.body.config.some((x) => x.config_key === "T_FLOOR" && x.version > 1),
  ).toBe(true);
});
test("staff can record anonymous finds and update custody, student cannot", async () => {
  const body = {
    ...(await refs()),
    item_name: "Anonymous bottle",
    found_date: "2026-01-01",
    private_feature: "Blue private mark",
    custody: "DEPOSITED_SECURITY",
    storage_location: "Security shelf A",
    anonymous: true,
  };
  expect((await auth("post", "/items/found", owner, body)).status).toBe(403);
  const r = await auth("post", "/items/found", staff, body);
  expect(r.status).toBe(201);
  const row = (
    await pool.query(
      "SELECT user_id,finder_note FROM found_items WHERE found_id=$1",
      [r.body.found_id],
    )
  ).rows[0];
  expect(row.user_id).toBeNull();
  expect(row.finder_note).toBeTruthy();
  expect(
    (
      await auth("patch", `/items/found/${r.body.found_id}/custody`, owner, {
        custody: "WITH_FINDER",
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await auth("patch", `/items/found/${r.body.found_id}/custody`, staff, {
        custody: "DEPOSITED_HOSTEL",
        storage_location: "Hostel reception",
      })
    ).status,
  ).toBe(200);
});
test("rejection is audited and permits a new proof, withdrawal is owner-only", async () => {
  const q = await pair(owner, finder);
  const c = await auth("post", "/claims", owner, {
    match_id: q.match_id,
    proof_text: "An incorrect identifying detail",
  });
  expect(c.status).toBe(201);
  expect(
    (
      await auth("post", `/claims/${c.body.claim_id}/reject`, finder, {
        decision_note: "The engraving is different.",
      })
    ).status,
  ).toBe(200);
  const next = await auth("post", "/claims", owner, {
    match_id: q.match_id,
    proof_text: "A tiny turtle engraved on the base",
  });
  expect(next.status).toBe(201);
  expect(
    (await auth("post", `/claims/${next.body.claim_id}/withdraw`, stranger, {}))
      .status,
  ).toBe(404);
  expect(
    (await auth("post", `/claims/${next.body.claim_id}/withdraw`, owner, {}))
      .status,
  ).toBe(200);
});
test("claim quota is enforced by the database for direct callers", async () => {
  const u = await user();
  for (let n = 0; n < 4; n++) {
    const q = await pair(u, finder);
    const r = await auth("post", "/claims", u, {
      match_id: q.match_id,
      proof_text: "A tiny turtle engraved on the base",
    });
    expect(r.status).toBe(n < 3 ? 201 : 409);
  }
});
test("lost reports can be edited only by their owner, prior to claims", async () => {
  const data = {
    ...(await refs()),
    item_name: "Edit this bottle",
    lost_date: "2026-01-01",
  };
  const r = await auth("post", "/items/lost", owner, data);
  expect(
    (await auth("patch", "/items/lost/" + r.body.lost_id, stranger, data))
      .status,
  ).toBe(404);
  expect(
    (
      await auth("patch", "/items/lost/" + r.body.lost_id, owner, {
        ...data,
        item_name: "Edited bottle",
      })
    ).status,
  ).toBe(200);
  expect(
    (await auth("get", "/items/mine/lost/" + r.body.lost_id, owner)).body
      .item_name,
  ).toBe("Edited bottle");
});
test("expiry job closes stale unclaimed reports with an audit trail", async () => {
  const r = await auth("post", "/items/lost", stranger, {
    ...(await refs()),
    item_name: "Old lost bottle",
    lost_date: "2026-01-01",
  });
  expect(r.status).toBe(201);
  await pool.query(
    "UPDATE lost_items SET created_at=NOW()-INTERVAL '100 days' WHERE lost_id=$1",
    [r.body.lost_id],
  );
  await require("../scripts/expire")();
  const row = (
    await pool.query("SELECT status FROM lost_items WHERE lost_id=$1", [
      r.body.lost_id,
    ])
  ).rows[0];
  expect(row.status).toBe("EXPIRED");
  const a = await pool.query(
    "SELECT 1 FROM audit_log WHERE entity_type='LOST_ITEM' AND entity_id=$1 AND new_status='EXPIRED' AND changed_by IS NULL",
    [r.body.lost_id],
  );
  expect(a.rowCount).toBe(1);
});
test("database rejects an inconsistent match band and invalid config values", async () => {
  await expect(
    pool.query(
      "UPDATE matches SET match_score=100,match_band='WEAK' WHERE match_id=$1",
      [p.match_id],
    ),
  ).rejects.toMatchObject({
    code: "23514",
    constraint: "ck_match_band_configured",
  });
  await expect(
    pool.query(
      "UPDATE match_config SET config_value=-1 WHERE config_key='W_CATEGORY'",
    ),
  ).rejects.toMatchObject({
    code: "23514",
    constraint: "ck_match_config_range",
  });
});
test("missing registration body produces a helpful validation error", async () => {
  expect((await request(app).post("/api/v1/auth/register")).status).toBe(400);
});
test("missing report body produces a validation error rather than 500", async () => {
  expect((await auth("post", "/items/lost", owner)).status).toBe(400);
});
test("malformed JSON receives a comprehensible error", async () => {
  const r = await request(app)
    .post("/api/v1/auth/register")
    .set("Content-Type", "application/json")
    .send("{bad");
  expect(r.status).toBe(400);
  expect(r.body.error).toBe("Please send a valid JSON request.");
});
test("calendar dates and optional time windows round-trip through report editing", async () => {
  const data = {
    ...(await refs()),
    item_name: "Date round trip",
    lost_date: "2026-01-01",
    lost_time_from: "09:00",
    lost_time_to: "10:00",
  };
  const created = await auth("post", "/items/lost", owner, data);
  expect(created.status).toBe(201);
  const saved = await auth(
    "get",
    "/items/mine/lost/" + created.body.lost_id,
    owner,
  );
  expect(saved.body.lost_date).toBe("2026-01-01");
  expect(saved.body.lost_time_from).toBe("09:00:00");
  expect(
    (
      await auth(
        "patch",
        "/items/lost/" + created.body.lost_id,
        owner,
        saved.body,
      )
    ).status,
  ).toBe(200);
});
