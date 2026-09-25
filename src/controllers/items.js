const { pool, withTransaction } = require('../db');
const { logAudit } = require('../services/audit');

async function createLost(req, res, next) {
  try {
    const { category_id, location_id, brand_id, colour_id, lost_date, item_name, description } = req.body;
    
    const result = await withTransaction(async (client) => {
      // 1. Insert lost item
      const insertRes = await client.query(
        `INSERT INTO lost_items (
          user_id, category_id, location_id, brand_id, colour_id, lost_date, item_name, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING lost_id`,
        [req.user.userId, category_id, location_id, brand_id, colour_id, lost_date, item_name, description]
      );
      const lost_id = insertRes.rows[0].lost_id;

      // 2. Audit
      await logAudit(client, {
        entity_type: 'LOST_ITEM',
        entity_id: lost_id,
        action: 'CREATED',
        changed_by: req.user.userId
      });

      // 3. Generate matches
      const matchRes = await client.query('CALL generate_matches_for_lost($1, null)', [lost_id]);
      
      // Top match retrieval
      const topMatchRes = await client.query(
        'SELECT match_id, found_id, match_score, match_band, status FROM matches WHERE lost_id = $1 ORDER BY match_score DESC LIMIT 1',
        [lost_id]
      );

      // Return
      return { lost_id, topMatch: topMatchRes.rows[0] || null };
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function createFound(req, res, next) {
  try {
    const { category_id, location_id, brand_id, colour_id, found_date, item_name, description, private_feature, custody, storage_location } = req.body;

    // Check if public duplicates private
    if (description && private_feature && description.includes(private_feature)) {
      return res.status(400).json({ error: 'Validation Error', details: 'Private feature must not be in public description' });
    }

    const result = await withTransaction(async (client) => {
      const insertRes = await client.query(
        `INSERT INTO found_items (
          user_id, category_id, location_id, brand_id, colour_id, found_date, item_name, description, private_feature, custody, storage_location
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING found_id`,
        [req.user.userId, category_id, location_id, brand_id, colour_id, found_date, item_name, description, private_feature, custody, storage_location]
      );
      const found_id = insertRes.rows[0].found_id;

      await logAudit(client, {
        entity_type: 'FOUND_ITEM',
        entity_id: found_id,
        action: 'CREATED',
        changed_by: req.user.userId
      });

      const matchRes = await client.query('CALL generate_matches_for_found($1, null)', [found_id]);
      
      const topMatchRes = await client.query(
        'SELECT match_id, lost_id, match_score, match_band, status FROM matches WHERE found_id = $1 ORDER BY match_score DESC LIMIT 1',
        [found_id]
      );

      return { found_id, topMatch: topMatchRes.rows[0] || null };
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function browseLost(req, res, next) {
  try {
    const { q, category_id, location_id, status, sort = 'newest', limit = 20, offset = 0 } = req.query;
    
    let queryText = 'SELECT *, count(*) OVER() as total_count FROM v_public_lost_items WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    if (q) {
      queryText += ` AND text_search @@ plainto_tsquery('english', $${paramIndex})`;
      params.push(q);
      paramIndex++;
    }

    if (category_id) {
      queryText += ` AND category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }

    if (location_id) {
      queryText += ` AND location_id = $${paramIndex}`;
      params.push(location_id);
      paramIndex++;
    }

    if (status) {
      queryText += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const sortMap = {
      'newest': 'created_at DESC',
      'oldest': 'created_at ASC',
      'date_desc': 'lost_date DESC',
      'date_asc': 'lost_date ASC'
    };

    const orderBy = sortMap[sort] || sortMap['newest'];
    queryText += ` ORDER BY ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(queryText, params);
    res.json({
      items: result.rows,
      total: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0
    });
  } catch (err) {
    next(err);
  }
}

async function browseFound(req, res, next) {
  try {
    const { q, category_id, location_id, status, sort = 'newest', limit = 20, offset = 0 } = req.query;
    
    let queryText = 'SELECT *, count(*) OVER() as total_count FROM v_public_found_items WHERE 1=1';
    let params = [];
    let paramIndex = 1;

    if (q) {
      queryText += ` AND text_search @@ plainto_tsquery('english', $${paramIndex})`;
      params.push(q);
      paramIndex++;
    }

    if (category_id) {
      queryText += ` AND category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }

    if (location_id) {
      queryText += ` AND location_id = $${paramIndex}`;
      params.push(location_id);
      paramIndex++;
    }

    if (status) {
      queryText += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const sortMap = {
      'newest': 'created_at DESC',
      'oldest': 'created_at ASC',
      'date_desc': 'found_date DESC',
      'date_asc': 'found_date ASC'
    };

    const orderBy = sortMap[sort] || sortMap['newest'];
    queryText += ` ORDER BY ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(queryText, params);
    res.json({
      items: result.rows,
      total: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0
    });
  } catch (err) {
    next(err);
  }
}

async function getLost(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM v_public_lost_items WHERE lost_id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

async function getFound(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM v_public_found_items WHERE found_id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createLost,
  createFound,
  browseLost,
  browseFound,
  getLost,
  getFound
};
