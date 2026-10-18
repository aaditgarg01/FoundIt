const { pool, withTransaction } = require("../db");
const Q = require("../../db/queries/items");
const V = require("../validation");
const staff = (u) => ["STAFF", "ADMIN"].includes(u.role);
const create = (kind) => async (req, res, next) => {
  try {
    const data = V.item(req.body, kind);
    let reporter = req.user.userId;
    if (kind === "found" && req.body.anonymous === true) {
      if (!staff(req.user))
        V.fail("Anonymous intake is available to campus staff.", 403);
      reporter = null;
      data.finder_note = V.text(
        req.body.finder_note || "Anonymous finder recorded by campus staff",
        "Finder note",
        1,
        160,
      );
    }
    const result = await withTransaction(async (c) => {
      const cat = (await c.query(Q.category, [data.category_id])).rows[0];
      if (!cat || !(await c.query(Q.references, [data.location_id])).rowCount)
        V.fail("Choose an active category and location.");
      const row = (await c.query(Q.insert(kind, data, reporter))).rows[0];
      const itemId = row[kind + "_id"];
      await c.query(kind === "lost" ? Q.matchLost : Q.matchFound, [itemId]);
      const top = (await c.query(Q.top(kind), [itemId])).rows[0] || null;
      return {
        ...row,
        topMatch: kind === "lost" ? top : null,
        custody_instruction:
          kind === "found"
            ? cat.requires_staff || data.is_high_value
              ? "Please deposit this item at campus security. Staff will verify ownership."
              : data.custody === "WITH_FINDER"
                ? "Keep the item safe. We will ask you to verify any ownership claims."
                : "Thank you. The campus staff will coordinate verification and collection."
            : undefined,
      };
    }, req.user.userId);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
};
const browse = (kind) => async (req, res, next) => {
  try {
    const q = Q.browse(kind, req.query);
    const [list, count] = await Promise.all([
      pool.query(q.list, [...q.params, q.limit, q.offset]),
      pool.query(q.count, q.params),
    ]);
    const items = list.rows.map(({ search_vector, ...row }) => row);
    res.json({
      items,
      total: count.rows[0].total,
      limit: q.limit,
      offset: q.offset,
    });
  } catch (e) {
    next(e);
  }
};
const detail = (kind) => async (req, res, next) => {
  try {
    const row = (await pool.query(Q.detail(kind), [V.id(req.params.id)]))
      .rows[0];
    if (!row) V.fail("Item not found.", 404);
    const { search_vector, ...safe } = row;
    res.json(safe);
  } catch (e) {
    next(e);
  }
};
async function mine(req, res, next) {
  try {
    const all = req.query.all === "true" && staff(req.user);
    const [l, f] = await Promise.all([
      pool.query(Q.mineLost, [req.user.userId, all]),
      pool.query(Q.mineFound, [req.user.userId, all]),
    ]);
    res.json({ lost: l.rows, found: f.rows });
  } catch (e) {
    next(e);
  }
}
const own = (kind) => async (req, res, next) => {
  try {
    const row = (
      await pool.query(Q.own(kind), [
        V.id(req.params.id),
        req.user.userId,
        staff(req.user),
      ])
    ).rows[0];
    if (!row) V.fail("Report not found.", 404);
    res.json(row);
  } catch (e) {
    next(e);
  }
};
async function withdraw(req, res, next) {
  try {
    const id = V.id(req.params.id);
    await withTransaction(async (c) => {
      const row = (await c.query(Q.withdrawLock, [id, req.user.userId]))
        .rows[0];
      if (!row) V.fail("Report not found.", 404);
      if (row.status !== "OPEN" || (await c.query(Q.hasClaims, [id])).rowCount)
        V.fail("A report with an active claim cannot be withdrawn.", 409);
      await c.query(Q.withdraw, [id]);
      await c.query(Q.invalidate, [id]);
    }, req.user.userId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
async function editLost(req, res, next) {
  try {
    const id = V.id(req.params.id),
      data = V.item(req.body, "lost");
    await withTransaction(async (c) => {
      const row = (await c.query(Q.withdrawLock, [id, req.user.userId]))
        .rows[0];
      if (!row) V.fail("Report not found.", 404);
      if (row.status !== "OPEN" || (await c.query(Q.hasClaims, [id])).rowCount)
        V.fail("Reports can only be edited before a claim is filed.", 409);
      await c.query(Q.updateLost(data), [...Object.values(data), id]);
      await c.query(Q.invalidateSuggested, [id]);
      await c.query(Q.reactivate, [id]);
      await c.query(Q.matchLost, [id]);
      await require("../services/audit").logAudit(c, {
        entity_type: "LOST_ITEM",
        entity_id: id,
        action: "UPDATED",
        changed_by: req.user.userId,
      });
    }, req.user.userId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
async function updateCustody(req, res, next) {
  try {
    const id = V.id(req.params.id),
      custody = req.body.custody;
    if (
      ![
        "WITH_FINDER",
        "DEPOSITED_SECURITY",
        "DEPOSITED_DEPARTMENT",
        "DEPOSITED_HOSTEL",
      ].includes(custody)
    )
      V.fail("Choose a valid custody option.");
    const storage = req.body.storage_location
      ? V.text(req.body.storage_location, "Storage location", 1, 160)
      : null;
    if (custody !== "WITH_FINDER" && !storage)
      V.fail("Specify where you deposited the item.");
    await withTransaction(async (c) => {
      const row = (
        await c.query(Q.custodyLock, [id, req.user.userId, staff(req.user)])
      ).rows[0];
      if (!row) V.fail("Report not found.", 404);
      if (row.status !== "AVAILABLE")
        V.fail("Custody can only be updated while the item is available.", 409);
      await c.query(Q.custody, [id, custody, storage]);
      await require("../services/audit").logAudit(c, {
        entity_type: "FOUND_ITEM",
        entity_id: id,
        action: "UPDATED",
        changed_by: req.user.userId,
      });
    }, req.user.userId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  updateCustody,
  createLost: create("lost"),
  createFound: create("found"),
  browseLost: browse("lost"),
  browseFound: browse("found"),
  getLost: detail("lost"),
  getFound: detail("found"),
  mine,
  ownLost: own("lost"),
  ownFound: own("found"),
  withdraw,
  editLost,
};
