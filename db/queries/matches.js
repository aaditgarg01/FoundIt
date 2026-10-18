const fields = `m.*,f.item_name,f.description,f.found_date,f.category_name,f.location_name,f.building,f.brand_name,f.colour_name,f.status AS found_status,l.item_name AS lost_name,l.description AS lost_description,l.lost_date`;
const join = `FROM matches m JOIN lost_items l USING(lost_id) JOIN v_public_found_items f USING(found_id)`;
module.exports = {
  owned: `SELECT 1 FROM lost_items WHERE lost_id=$1 AND (user_id=$2 OR $3)`,
  list: `SELECT ${fields} ${join} WHERE m.lost_id=$1 AND (l.user_id=$2 OR $3) AND m.status NOT IN ('REJECTED_BY_USER','INVALIDATED') ORDER BY m.match_score DESC,m.match_id`,
  detail: `SELECT ${fields} ${join} WHERE m.match_id=$1 AND (l.user_id=$2 OR $3)`,
  dismiss: `UPDATE matches m SET status=$3,updated_at=NOW() FROM lost_items l WHERE m.lost_id=l.lost_id AND m.match_id=$1 AND l.user_id=$2 AND m.status=$4 RETURNING m.match_id`,
};
