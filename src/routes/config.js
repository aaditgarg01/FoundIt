const r = require("express").Router(),
  { pool, withTransaction } = require("../db"),
  Q = require("../../db/queries/config"),
  V = require("../validation");
const { requireAuth, requireRole } = require("../middlewares/auth");
r.use(requireAuth, requireRole(["ADMIN"]));
r.get("/", async (req, res, next) => {
  try {
    res.json({ config: (await pool.query(Q.list)).rows });
  } catch (e) {
    next(e);
  }
});
r.patch("/", async (req, res, next) => {
  try {
    await withTransaction(async (c) => {
      await c.query(Q.lock);
      const current = Object.fromEntries(
        (await c.query(Q.list)).rows.map((x) => [x.config_key, x.config_value]),
      );
      const changes = req.body;
      if (!changes || Array.isArray(changes) || !Object.keys(changes).length)
        V.fail("Supply scoring settings to update.");
      for (const [k, v] of Object.entries(changes)) {
        if (!(k in current) || !Number.isInteger(v) || v < 0 || v > 365)
          V.fail(
            "Settings must be known keys with whole-number values from 0 to 365.",
          );
        current[k] = v;
      }
      const weightKeys = [
        "W_CATEGORY",
        "W_BRAND",
        "W_COLOUR",
        "W_LOCATION",
        "W_DATE_MAX",
        "W_DESC_MAX",
      ];
      if (weightKeys.reduce((s, k) => s + current[k], 0) !== 100)
        V.fail("The six matching weights must add up to 100.");
      if (!(
        current.T_FLOOR < current.T_POSSIBLE &&
        current.T_POSSIBLE < current.T_STRONG &&
        current.T_STRONG <= 100
      ))
        V.fail("Thresholds must satisfy floor < possible < strong ≤ 100.");
      for (const k of [
        "MAX_PENDING_CLAIMS",
        "RETENTION_DAYS",
        "DATE_WINDOW_DAYS",
      ])
        if (current[k] < 1) V.fail("Limits and day windows must be positive.");
      for (const [k, v] of Object.entries(changes))
        await c.query(Q.update, [k, v]);
      await c.query(Q.setBand, ["WEAK", 0, current.T_POSSIBLE - 1]);
      await c.query(Q.setBand, [
        "POSSIBLE",
        current.T_POSSIBLE,
        current.T_STRONG - 1,
      ]);
      await c.query(Q.setBand, ["STRONG", current.T_STRONG, 100]);
      // Existing matches keep their original score, reason and band as historical evidence.
    }, req.user.userId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});
module.exports = r;
