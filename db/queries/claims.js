const verifier = `c.claimant_id<>$2 AND ($3 OR (f.user_id=$2 AND NOT cat.requires_staff AND NOT f.is_high_value AND f.custody='WITH_FINDER'))`;
const party = `(c.claimant_id=$2 OR f.user_id=$2 OR $3)`;
const joins = `FROM claims c JOIN found_items f USING(found_id) JOIN categories cat ON cat.category_id=f.category_id JOIN matches m ON m.match_id=c.match_id JOIN lost_items l ON l.lost_id=m.lost_id`;
module.exports = {
  list: `SELECT c.claim_id,c.status,c.claimed_at,c.decided_at,c.completed_at,c.decision_note,c.match_id,f.item_name,f.found_id,m.lost_id,cat.category_name,(${verifier}) AS can_verify,(c.claimant_id=$2) AS is_claimant ${joins} WHERE $1::int IS NOT NULL AND ${party} ORDER BY c.claimed_at DESC LIMIT 100`,
  detail: `SELECT c.claim_id,c.match_id,c.status,c.claimed_at,c.decided_at,c.completed_at,c.decision_note,f.item_name,f.found_id,m.lost_id,f.custody,cat.category_name,
 (${verifier}) AS can_verify,(c.claimant_id=$2) AS is_claimant,
 CASE WHEN (${verifier}) THEN c.proof_text END AS proof_text,
 CASE WHEN (${verifier}) THEN f.private_feature END AS private_feature,
 CASE WHEN c.status IN ('APPROVED','COMPLETED') THEN f.storage_location END AS storage_location,
 CASE WHEN c.status IN ('APPROVED','COMPLETED') THEN jsonb_build_object('full_name',u.full_name,'email',u.email,'phone',u.phone) END AS claimant_contact,
 CASE WHEN c.status IN ('APPROVED','COMPLETED') THEN jsonb_build_object('full_name',v.full_name,'email',v.email,'phone',v.phone) END AS finder_contact
 ${joins} JOIN users u ON u.user_id=c.claimant_id LEFT JOIN users v ON v.user_id=f.user_id WHERE c.claim_id=$1 AND ${party}`,
  create: `INSERT INTO claims(match_id,claimant_id,proof_text) SELECT m.match_id,$2,$3 FROM matches m JOIN lost_items l USING(lost_id) WHERE m.match_id=$1 AND l.user_id=$2 RETURNING claim_id`,
  claimed: `UPDATE matches SET status='CLAIMED',updated_at=NOW() WHERE match_id=$1`,
  approve: `CALL approve_claim($1,$2)`,
  lockFound: `SELECT f.found_id ${joins} WHERE c.claim_id=$1 AND ${party} FOR UPDATE OF f`,
  lock: `SELECT c.*,m.lost_id,(${verifier}) AS can_verify ${joins} WHERE c.claim_id=$1 AND ${party} FOR UPDATE OF c`,
  lockLost: `SELECT lost_id FROM lost_items WHERE lost_id=$1 FOR UPDATE`,
  reject: `UPDATE claims SET status='REJECTED',verifier_id=$2,decided_at=NOW(),decision_note=$3 WHERE claim_id=$1`,
  flag: `UPDATE users SET flagged_count=flagged_count+1 WHERE user_id=$1`,
  suggest: `UPDATE matches SET status='SUGGESTED',updated_at=NOW() WHERE match_id=$1 AND status='CLAIMED'`,
  complete: `UPDATE claims SET status='COMPLETED',completed_at=NOW() WHERE claim_id=$1`,
  returned: `UPDATE found_items SET status='RETURNED',returned_at=NOW(),updated_at=NOW() WHERE found_id=$1`,
  resolved: `UPDATE lost_items SET status='RESOLVED',resolved_at=NOW(),updated_at=NOW() WHERE lost_id=$1`,
  withdraw: `UPDATE claims SET status='WITHDRAWN' WHERE claim_id=$1`,
  timeline: `SELECT a.audit_id,a.entity_type,a.action,a.old_status,a.new_status,a.changed_at,coalesce(u.full_name,'System') AS actor FROM audit_log a LEFT JOIN users u ON u.user_id=a.changed_by WHERE (a.entity_type='CLAIM' AND a.entity_id=$1) OR (a.entity_type='FOUND_ITEM' AND a.entity_id=$2) OR (a.entity_type='LOST_ITEM' AND a.entity_id=$3) ORDER BY a.changed_at,a.audit_id`,
};
