const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32)
  throw new Error("Set JWT_SECRET to at least 32 random characters");
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer "))
      return res.status(401).json({ error: "Please sign in to continue." });
    let payload;
    try {
      payload = jwt.verify(header.slice(7), JWT_SECRET, {
        algorithms: ["HS256"],
      });
    } catch {
      return res
        .status(401)
        .json({ error: "Your session has expired. Please sign in again." });
    }
    const { rows } = await pool.query(
      require("../../db/queries/auth").activeSession,
      [payload.userId, payload.sid],
    );
    if (!rows[0])
      return res
        .status(401)
        .json({ error: "Your session has expired. Please sign in again." });
    req.user = { ...rows[0], userId: rows[0].user_id, sid: payload.sid };
    next();
  } catch (e) {
    next(e);
  }
}
function requireRole(roles) {
  return (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({ error: "This page is for campus staff." });
}
module.exports = { requireAuth, requireRole, JWT_SECRET };
