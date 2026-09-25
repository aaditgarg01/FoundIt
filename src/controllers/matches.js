const { pool, withTransaction } = require('../db');
const { logAudit } = require('../services/audit');

async function getMatchesForLost(req, res, next) {
  try {
    const { lost_id } = req.params;

    // Verify ownership in the WHERE clause, return 404 if not found or not owned
    const checkLost = await pool.query('SELECT 1 FROM lost_items WHERE lost_id = $1 AND user_id = $2', [lost_id, req.user.userId]);
    if (checkLost.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const matches = await pool.query(
      `SELECT m.*, f.item_name, f.description, f.found_date, f.category_id, f.location_id, f.brand_id, f.colour_id 
       FROM matches m
       JOIN v_public_found_items f ON m.found_id = f.found_id
       WHERE m.lost_id = $1 AND m.status != 'REJECTED'
       ORDER BY m.match_score DESC`,
      [lost_id]
    );

    res.json({ matches: matches.rows });
  } catch (err) {
    next(err);
  }
}

async function getMatchDetail(req, res, next) {
  try {
    const { match_id } = req.params;
    
    // Validate match exists and user owns the lost item
    const match = await pool.query(
      `SELECT m.*, f.item_name, f.description, f.found_date, f.category_id, f.location_id, f.brand_id, f.colour_id
       FROM matches m
       JOIN lost_items l ON m.lost_id = l.lost_id
       JOIN v_public_found_items f ON m.found_id = f.found_id
       WHERE m.match_id = $1 AND l.user_id = $2`,
      [match_id, req.user.userId]
    );

    if (match.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(match.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function dismissMatch(req, res, next) {
  try {
    const { match_id } = req.params;

    const result = await withTransaction(async (client) => {
      // Must verify ownership and current status
      const matchRes = await client.query(
        `SELECT m.match_id, m.status, m.lost_id 
         FROM matches m
         JOIN lost_items l ON m.lost_id = l.lost_id
         WHERE m.match_id = $1 AND l.user_id = $2 FOR UPDATE`,
        [match_id, req.user.userId]
      );

      if (matchRes.rows.length === 0) {
        throw { status: 404, message: 'Not found' };
      }

      const match = matchRes.rows[0];
      if (match.status !== 'SUGGESTED') {
        throw { status: 400, message: 'Match is not in a dismissible state' };
      }

      await client.query(
        `UPDATE matches SET status = 'REJECTED', updated_at = NOW() WHERE match_id = $1`,
        [match_id]
      );

      await logAudit(client, {
        entity_type: 'MATCH',
        entity_id: match_id,
        action: 'STATUS_CHANGED',
        old_status: 'SUGGESTED',
        new_status: 'REJECTED',
        changed_by: req.user.userId
      });

      return { success: true };
    });

    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
}

module.exports = {
  getMatchesForLost,
  getMatchDetail,
  dismissMatch
};
