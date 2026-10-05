const { pool, withTransaction } = require('../db');
const { logAudit } = require('../services/audit');

// T3.5 Claim creation
async function createClaim(req, res, next) {
  try {
    const { match_id, proof_text } = req.body;
    const claimant_id = req.user.userId;

    // We will do a single read for the match and item states to validate ownership and availability.
    // Cost ascending: 
    // 1. Pending claims count
    // 2. Rejected claims count
    // 3. Ownership and availability
    // 4. (Trigger checks self claim)

    const pendingRes = await pool.query(
      `SELECT count(*) FROM claims WHERE claimant_id = $1 AND status = 'PENDING'`,
      [claimant_id]
    );
    if (parseInt(pendingRes.rows[0].count) >= 3) {
      return res.status(403).json({ error: 'Max pending claims reached' });
    }

    const matchRes = await pool.query(`
      SELECT m.lost_id, m.found_id, l.user_id as owner_id, f.status as found_status
      FROM matches m
      JOIN lost_items l ON m.lost_id = l.lost_id
      JOIN found_items f ON m.found_id = f.found_id
      WHERE m.match_id = $1
    `, [match_id]);

    if (matchRes.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const { found_id, owner_id, found_status } = matchRes.rows[0];

    if (owner_id !== claimant_id) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (found_status !== 'AVAILABLE') {
      return res.status(400).json({ error: 'Item no longer available' });
    }

    const rejectedRes = await pool.query(
      `SELECT count(*) FROM claims WHERE claimant_id = $1 AND found_id = $2 AND status = 'REJECTED'`,
      [claimant_id, found_id]
    );
    if (parseInt(rejectedRes.rows[0].count) >= 3) {
      return res.status(403).json({ error: 'Max claims per item reached' });
    }

    const result = await withTransaction(async (client) => {
      const insertRes = await client.query(
        `INSERT INTO claims (match_id, claimant_id, proof_text, status)
         VALUES ($1, $2, $3, 'PENDING') RETURNING claim_id`,
        [match_id, claimant_id, proof_text]
      );
      const claim_id = insertRes.rows[0].claim_id;

      await client.query(`UPDATE matches SET status = 'CLAIMED' WHERE match_id = $1`, [match_id]);

      await logAudit(client, {
        entity_type: 'CLAIM',
        entity_id: claim_id,
        action: 'CLAIM_CREATED',
        new_status: 'PENDING',
        changed_by: claimant_id
      });

      return { claim_id };
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.code === 'P0001' && err.message.includes('Finder cannot claim')) {
      return res.status(400).json({ error: 'Finder cannot claim their own found item' });
    }
    next(err);
  }
}

// T3.6 Approve Claim
async function approveClaim(req, res, next) {
  try {
    const claim_id = req.params.id;
    const verifier_id = req.user.userId;

    const result = await withTransaction(async (client) => {
      // Prevent self verify
      const claimRes = await client.query(`SELECT claimant_id FROM claims WHERE claim_id = $1`, [claim_id]);
      if (claimRes.rows.length === 0) throw new Error('CLAIM_NOT_FOUND');
      if (claimRes.rows[0].claimant_id === verifier_id) {
        throw new Error('SELF_VERIFY');
      }

      await client.query('CALL approve_claim($1, $2)', [claim_id, verifier_id]);
      return { success: true };
    });

    res.json(result);
  } catch (err) {
    if (err.message === 'CLAIM_NOT_FOUND') return res.status(404).json({ error: 'Claim not found' });
    if (err.message === 'SELF_VERIFY') return res.status(403).json({ error: 'Cannot verify own claim' });
    if (err.code === 'P0001') {
      if (err.message.includes('ITEM_NOT_AVAILABLE')) return res.status(409).json({ error: 'Item not available' });
      if (err.message.includes('CLAIM_NOT_PENDING')) return res.status(400).json({ error: 'Claim is not pending' });
    }
    next(err);
  }
}

// T3.7 Reject Claim
async function rejectClaim(req, res, next) {
  try {
    const claim_id = req.params.id;
    const verifier_id = req.user.userId;
    const { decision_note } = req.body;

    const result = await withTransaction(async (client) => {
      const claimRes = await client.query(`SELECT status, match_id, claimant_id, found_id FROM claims WHERE claim_id = $1 FOR UPDATE`, [claim_id]);
      if (claimRes.rows.length === 0) throw new Error('CLAIM_NOT_FOUND');
      
      const claim = claimRes.rows[0];
      if (claim.status !== 'PENDING') throw new Error('CLAIM_NOT_PENDING');
      if (claim.claimant_id === verifier_id) throw new Error('SELF_VERIFY');

      // Update claim
      await client.query(
        `UPDATE claims SET status = 'REJECTED', verifier_id = $1, decided_at = NOW(), decision_note = $2 WHERE claim_id = $3`,
        [verifier_id, decision_note || 'Rejected by verifier', claim_id]
      );

      // Increment flagged count for user
      await client.query(`UPDATE users SET flagged_count = flagged_count + 1 WHERE user_id = $1`, [claim.claimant_id]);

      // Return match to SUGGESTED
      await client.query(`UPDATE matches SET status = 'SUGGESTED' WHERE match_id = $1`, [claim.match_id]);

      await logAudit(client, {
        entity_type: 'CLAIM',
        entity_id: claim_id,
        action: 'CLAIM_REJECTED',
        old_status: 'PENDING',
        new_status: 'REJECTED',
        changed_by: verifier_id,
        detail: { note: decision_note }
      });

      return { success: true };
    });

    res.json(result);
  } catch (err) {
    if (err.message === 'CLAIM_NOT_FOUND') return res.status(404).json({ error: 'Claim not found' });
    if (err.message === 'SELF_VERIFY') return res.status(403).json({ error: 'Cannot verify own claim' });
    if (err.message === 'CLAIM_NOT_PENDING') return res.status(400).json({ error: 'Claim not pending' });
    next(err);
  }
}

// T3.8 Complete Handover
async function completeHandover(req, res, next) {
  try {
    const claim_id = req.params.id;
    const user_id = req.user.userId;

    const result = await withTransaction(async (client) => {
      const claimRes = await client.query(`SELECT status, found_id, match_id FROM claims WHERE claim_id = $1 FOR UPDATE`, [claim_id]);
      if (claimRes.rows.length === 0) throw new Error('CLAIM_NOT_FOUND');
      
      const claim = claimRes.rows[0];
      if (claim.status !== 'APPROVED') throw new Error('CLAIM_NOT_APPROVED');

      // Update claim
      await client.query(`UPDATE claims SET status = 'COMPLETED', completed_at = NOW() WHERE claim_id = $1`, [claim_id]);

      // Update found item
      await client.query(`UPDATE found_items SET status = 'RETURNED', updated_at = NOW() WHERE found_id = $1`, [claim.found_id]);

      // Update lost item
      await client.query(`
        UPDATE lost_items SET status = 'RESOLVED', updated_at = NOW() 
        WHERE lost_id = (SELECT lost_id FROM matches WHERE match_id = $1)
      `, [claim.match_id]);

      await logAudit(client, {
        entity_type: 'CLAIM',
        entity_id: claim_id,
        action: 'HANDOVER_COMPLETED',
        old_status: 'APPROVED',
        new_status: 'COMPLETED',
        changed_by: user_id
      });

      return { success: true };
    });

    res.json(result);
  } catch (err) {
    if (err.message === 'CLAIM_NOT_FOUND') return res.status(404).json({ error: 'Claim not found' });
    if (err.message === 'CLAIM_NOT_APPROVED') return res.status(400).json({ error: 'Claim not approved' });
    next(err);
  }
}

// T3.11 Audit timeline
async function getTimeline(req, res, next) {
  try {
    const claim_id = req.params.id;
    
    // Check if user is party to this claim
    const claimRes = await pool.query(`
      SELECT c.claimant_id, f.user_id as finder_id, c.verifier_id 
      FROM claims c JOIN found_items f ON c.found_id = f.found_id
      WHERE c.claim_id = $1
    `, [claim_id]);

    if (claimRes.rows.length === 0) return res.status(404).json({ error: 'Claim not found' });
    
    const { claimant_id, finder_id, verifier_id } = claimRes.rows[0];
    const user_id = req.user.userId;

    if (user_id !== claimant_id && user_id !== finder_id && user_id !== verifier_id && req.user.role !== 'STAFF') {
      return res.status(404).json({ error: 'Claim not found' }); // Party check: 404 instead of 403
    }

    const auditRes = await pool.query(`
      SELECT * FROM audit_log
      WHERE (entity_type = 'CLAIM' AND entity_id = $1)
      ORDER BY created_at ASC, audit_id ASC
    `, [claim_id]);

    res.json({ timeline: auditRes.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createClaim,
  approveClaim,
  rejectClaim,
  completeHandover,
  getTimeline
};
