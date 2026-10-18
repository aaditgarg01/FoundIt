const r = require("express").Router(),
  { pool } = require("../db"),
  Q = require("../../db/queries/dashboard");
const { requireAuth, requireRole } = require("../middlewares/auth");
r.get("/summary", async (req, res, next) => {
  try {
    const [s, i] = await Promise.all([
      pool.query(Q.stats),
      pool.query(Q.recent),
    ]);
    res.json({ ...s.rows[0], recent: i.rows });
  } catch (e) {
    next(e);
  }
});
r.get(
  "/analytics",
  requireAuth,
  requireRole(["STAFF", "ADMIN"]),
  async (req, res, next) => {
    try {
      const [s, c, h, a, f] = await Promise.all([
        pool.query(Q.stats),
        pool.query(Q.analytics),
        pool.query(Q.hotspots),
        pool.query(Q.ageing),
        pool.query(Q.flags),
      ]);
      res.json({
        ...s.rows[0],
        categories: c.rows,
        hotspots: h.rows,
        ageing: a.rows,
        flagged_users: f.rows,
      });
    } catch (e) {
      next(e);
    }
  },
);
module.exports = r;
