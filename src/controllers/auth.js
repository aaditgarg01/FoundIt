const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomBytes, createHash } = require("node:crypto");
const { pool, withTransaction } = require("../db");
const Q = require("../../db/queries/auth");
const { JWT_SECRET } = require("../middlewares/auth");
const { text, fail } = require("../validation");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const sign = (u, sid) =>
  jwt.sign({ userId: u.user_id, sid }, JWT_SECRET, {
    expiresIn: "1h",
    algorithm: "HS256",
  });
async function register(req, res, next) {
  try {
    const email = text(req.body.email, "Email", 3, 160).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail("Enter a valid email address.");
    const domains = (process.env.ALLOWED_EMAIL_DOMAINS || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (domains.length && !domains.includes(email.split("@")[1]))
      fail("Use your campus email address.");
    const password = text(req.body.password, "Password", 8, 72);
    if (Buffer.byteLength(password) > 72)
      fail("Password must be at most 72 bytes.");
    if (req.body.role && req.body.role !== "STUDENT")
      fail("Staff accounts are provisioned by an administrator.");
    const result = await pool.query(Q.register, [
      email,
      await bcrypt.hash(password, 12),
      text(req.body.full_name, "Full name", 1, 120),
      req.body.phone ? text(req.body.phone, "Phone", 1, 20) : null,
      req.body.department
        ? text(req.body.department, "Department", 1, 100)
        : null,
    ]);
    res.status(201).json({ user: result.rows[0] });
  } catch (e) {
    next(e);
  }
}
async function login(req, res, next) {
  try {
    const email = text(req.body.email, "Email", 3, 160);
    const password = text(req.body.password, "Password", 1, 72);
    const { rows } = await pool.query(Q.byEmail, [email]);
    const u = rows[0];
    const valid = await bcrypt.compare(
      password,
      u?.password_hash ||
        "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
    );
    if (!u || !valid) fail("Email or password is incorrect.", 401);
    const refreshToken = randomBytes(32).toString("hex");
    const sid = hash(refreshToken);
    await pool.query(Q.session, [sid, u.user_id]);
    res.json({
      token: sign(u, sid),
      refreshToken,
      user: {
        user_id: u.user_id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        phone: u.phone,
        department: u.department,
      },
    });
  } catch (e) {
    next(e);
  }
}
async function refresh(req, res, next) {
  try {
    const raw = text(req.body.refreshToken, "Session", 1, 128);
    const { rows } = await pool.query(Q.refresh, [hash(raw)]);
    if (!rows[0]) fail("Please sign in again.", 401);
    res.json({ token: sign(rows[0], rows[0].session_id) });
  } catch (e) {
    next(e);
  }
}
async function logout(req, res, next) {
  try {
    await pool.query(Q.logout, [req.user.sid, req.user.userId]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
async function me(req, res) {
  const { sid, userId, ...user } = req.user;
  res.json({ user });
}
async function updateProfile(req, res, next) {
  try {
    const user = await withTransaction(async (c) => {
      const r = await c.query(Q.profile, [
        text(req.body.full_name, "Full name", 1, 120),
        req.body.phone ? text(req.body.phone, "Phone", 1, 20) : null,
        req.body.department
          ? text(req.body.department, "Department", 1, 100)
          : null,
        req.user.userId,
      ]);
      await require("../services/audit").logAudit(c, {
        entity_type: "USER",
        entity_id: req.user.userId,
        action: "UPDATED",
        changed_by: req.user.userId,
      });
      return r.rows[0];
    }, req.user.userId);
    res.json({ user });
  } catch (e) {
    next(e);
  }
}
module.exports = { register, login, logout, refresh, me, updateProfile };
