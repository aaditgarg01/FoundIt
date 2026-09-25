const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { JWT_SECRET } = require('../middlewares/auth');

async function register(req, res, next) {
  try {
    const { email, password, full_name, role = 'STUDENT' } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const hash = await bcrypt.hash(password, 12);
    
    // Uses RETURNING to get created user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING user_id, email, full_name, role',
      [email, hash, full_name, role]
    );
    
    const user = result.rows[0];
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
    const user = result.rows[0];

    // Timing equalization: always compare against something if user not found
    const hashToCompare = user ? user.password_hash : await bcrypt.hash('dummy', 12);
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!user || !valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Issue JWT
    const payload = { userId: user.user_id, role: user.role, email: user.email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    // Issue refresh token
    const sid = uuidv4();
    const expire = new Date();
    expire.setDate(expire.getDate() + 7); // 7 days

    await pool.query(
      'INSERT INTO sessions (sid, sess, expire, user_id) VALUES ($1, $2, $3, $4)',
      [sid, JSON.stringify({ refreshToken: true }), expire, user.user_id]
    );

    res.json({ token, refreshToken: sid, user: { user_id: user.user_id, email: user.email, role: user.role, full_name: user.full_name } });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await pool.query('DELETE FROM sessions WHERE sid = $1 AND user_id = $2', [refreshToken, req.user.userId]);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

    const result = await pool.query('SELECT * FROM sessions WHERE sid = $1 AND expire > NOW()', [refreshToken]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const session = result.rows[0];
    
    const userRes = await pool.query('SELECT * FROM users WHERE user_id = $1 AND is_active = true', [session.user_id]);
    const user = userRes.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const payload = { userId: user.user_id, role: user.role, email: user.email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  res.json({ user: req.user });
}

module.exports = {
  register,
  login,
  logout,
  refresh,
  me
};
