const { pool, withTransaction } = require("../db");
const Q = require("../../db/queries/matches");
const V = require("../validation");
const a = (req) => [
  V.id(req.params.lost_id || req.params.match_id),
  req.user.userId,
  ["STAFF", "ADMIN"].includes(req.user.role),
];
async function getMatchesForLost(req, res, next) {
  try {
    if (!(await pool.query(Q.owned, a(req))).rowCount)
      V.fail("Report not found.", 404);
    res.json({ matches: (await pool.query(Q.list, a(req))).rows });
  } catch (e) {
    next(e);
  }
}
async function getMatchDetail(req, res, next) {
  try {
    const r = (await pool.query(Q.detail, a(req))).rows[0];
    if (!r) V.fail("Match not found.", 404);
    res.json(r);
  } catch (e) {
    next(e);
  }
}
const dismiss = (undo) => async (req, res, next) => {
  try {
    await withTransaction(async (c) => {
      const r = await c.query(Q.dismiss, [
        V.id(req.params.match_id),
        req.user.userId,
        undo ? "SUGGESTED" : "REJECTED_BY_USER",
        undo ? "REJECTED_BY_USER" : "SUGGESTED",
      ]);
      if (!r.rowCount) V.fail("This match cannot be changed.", 404);
    }, req.user.userId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};
module.exports = {
  getMatchesForLost,
  getMatchDetail,
  dismissMatch: dismiss(false),
  undoDismiss: dismiss(true),
};
