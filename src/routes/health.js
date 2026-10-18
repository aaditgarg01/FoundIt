const express = require("express");
const { pool } = require("../db");

const router = express.Router();

router.get("/health", async (req, res, next) => {
  try {
    const result = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", db: result.rows[0].ok === 1 });
  } catch (error) {
    res.status(503).json({ status: "error", db: false });
  }
});

module.exports = router;
