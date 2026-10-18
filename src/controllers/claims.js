const { pool, withTransaction } = require("../db");
const Q = require("../../db/queries/claims");
const V = require("../validation");
const staff = (req) => ["STAFF", "ADMIN"].includes(req.user.role);
const args = (req) => [V.id(req.params.id || 1), req.user.userId, staff(req)];
async function list(req, res, next) {
  try {
    res.json({ claims: (await pool.query(Q.list, args(req))).rows });
  } catch (e) {
    next(e);
  }
}
async function detail(req, res, next) {
  try {
    const row = (await pool.query(Q.detail, args(req))).rows[0];
    if (!row) V.fail("Claim not found.", 404);
    res.json(row);
  } catch (e) {
    next(e);
  }
}
async function createClaim(req, res, next) {
  try {
    const match = V.id(req.body.match_id),
      proof = V.text(req.body.proof_text, "Proof of ownership", 10, 3000);
    const row = await withTransaction(async (c) => {
      const r = (await c.query(Q.create, [match, req.user.userId, proof]))
        .rows[0];
      if (!r) V.fail("Match not found.", 404);
      await c.query(Q.claimed, [match]);
      return r;
    }, req.user.userId);
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
}
async function approveClaim(req, res, next) {
  try {
    await withTransaction(
      (c) => c.query(Q.approve, [V.id(req.params.id), req.user.userId]),
      req.user.userId,
    );
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
const transition = (action) => async (req, res, next) => {
  try {
    await withTransaction(async (c) => {
      const a = args(req);
      if (!(await c.query(Q.lockFound, a)).rowCount)
        V.fail("Claim not found.", 404);
      const row = (await c.query(Q.lock, a)).rows[0];
      if (!row) V.fail("Claim not found.", 404);
      if (action === "reject") {
        if (!row.can_verify) V.fail("Claim not found.", 404);
        if (row.status !== "PENDING")
          V.fail("This claim is no longer pending.", 409);
        const note = V.text(
          req.body.decision_note || "The identifying details do not match.",
          "Decision note",
          1,
          300,
        );
        await c.query(Q.reject, [row.claim_id, req.user.userId, note]);
        await c.query(Q.flag, [row.claimant_id]);
        await c.query(Q.suggest, [row.match_id]);
      }
      if (action === "withdraw") {
        if (row.claimant_id !== req.user.userId)
          V.fail("Claim not found.", 404);
        if (row.status !== "PENDING")
          V.fail("Only a pending claim can be withdrawn.", 409);
        await c.query(Q.withdraw, [row.claim_id]);
        await c.query(Q.suggest, [row.match_id]);
      }
      if (action === "handover") {
        if (row.status !== "APPROVED")
          V.fail("This claim must be approved before handover.", 409);
        await c.query(Q.lockLost, [row.lost_id]);
        await c.query(Q.complete, [row.claim_id]);
        await c.query(Q.returned, [row.found_id]);
        await c.query(Q.resolved, [row.lost_id]);
      }
    }, req.user.userId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};
async function getTimeline(req, res, next) {
  try {
    const row = (await pool.query(Q.detail, args(req))).rows[0];
    if (!row) V.fail("Claim not found.", 404);
    res.json({
      timeline: (
        await pool.query(Q.timeline, [row.claim_id, row.found_id, row.lost_id])
      ).rows,
    });
  } catch (e) {
    next(e);
  }
}
module.exports = {
  list,
  detail,
  createClaim,
  approveClaim,
  rejectClaim: transition("reject"),
  completeHandover: transition("handover"),
  withdraw: transition("withdraw"),
  getTimeline,
};
