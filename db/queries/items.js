const V = require("../../src/validation");
const kinds = {
  lost: {
    table: "lost_items",
    view: "v_public_lost_items",
    id: "lost_id",
    date: "lost_date",
  },
  found: {
    table: "found_items",
    view: "v_public_found_items",
    id: "found_id",
    date: "found_date",
  },
};
function browse(kind, q) {
  const k = kinds[kind];
  const params = [];
  const predicates = [];
  const add = (sql, v) => {
    params.push(v);
    predicates.push(sql.replace("?", `$${params.length}`));
  };
  if (q.q)
    add(
      "search_vector @@ plainto_tsquery('english', ?)",
      V.text(q.q, "Search", 1, 120),
    );
  for (const key of ["category_id", "location_id", "colour_id"])
    if (q[key]) add(`${key} = ?`, V.id(q[key]));
  if (q.building) add("building = ?", V.text(q.building, "Building", 1, 80));
  if (q.date_from) add(`${k.date} >= ?`, V.date(q.date_from));
  if (q.date_to) add(`${k.date} <= ?`, V.date(q.date_to));
  add("status = ?", q.status || (kind === "found" ? "AVAILABLE" : "OPEN"));
  const sort = {
    newest: `${k.date} DESC,${k.id} DESC`,
    oldest: `${k.date} ASC,${k.id} ASC`,
  }[q.sort || "newest"];
  if (!sort) V.fail("Choose a valid sort order.");
  const limit = q.limit === undefined ? 12 : V.id(q.limit, "Page size");
  if (limit > 50) V.fail("Page size cannot exceed 50.");
  const offset = q.offset === undefined ? 0 : Number(q.offset);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
    V.fail("Invalid page offset.");
  const where = predicates.join(" AND ");
  return {
    list: `SELECT * FROM ${k.view} WHERE ${where} ORDER BY ${sort} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    count: `SELECT count(*)::int AS total FROM ${k.view} WHERE ${where}`,
    params,
    limit,
    offset,
  };
}
function insert(kind, data, userId) {
  const k = kinds[kind];
  const cols = ["user_id", ...Object.keys(data)];
  return {
    text: `INSERT INTO ${k.table}(${cols.join(",")}) VALUES(${cols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING ${k.id}`,
    values: [userId, ...Object.values(data)],
  };
}
module.exports = {
  browse,
  insert,
  custodyLock: `SELECT status FROM found_items WHERE found_id=$1 AND (user_id=$2 OR $3) FOR UPDATE`,
  custody: `UPDATE found_items SET custody=$2,storage_location=$3,updated_at=NOW() WHERE found_id=$1`,
  detail: (kind) =>
    `SELECT * FROM ${kinds[kind].view} WHERE ${kinds[kind].id}=$1`,
  own: (kind) =>
    `SELECT i.*,c.category_name,l.location_name,l.building FROM ${kinds[kind].table} i JOIN categories c USING(category_id) JOIN locations l USING(location_id) WHERE i.${kinds[kind].id}=$1 AND (i.user_id=$2 OR $3)`,
  mineLost: `SELECT l.*,c.category_name,loc.location_name,(SELECT count(*)::int FROM matches m WHERE m.lost_id=l.lost_id AND m.status='SUGGESTED') AS match_count,(SELECT max(match_score) FROM matches m WHERE m.lost_id=l.lost_id AND m.status='SUGGESTED') AS top_score FROM lost_items l JOIN categories c USING(category_id) JOIN locations loc USING(location_id) WHERE l.user_id=$1 OR $2 ORDER BY l.created_at DESC LIMIT 100`,
  mineFound: `SELECT f.found_id,f.item_name,f.category_id,f.location_id,f.found_date,f.status,f.custody,f.created_at,c.category_name,l.location_name FROM found_items f JOIN categories c USING(category_id) JOIN locations l USING(location_id) WHERE f.user_id=$1 OR $2 ORDER BY f.created_at DESC LIMIT 100`,
  matchLost: `SELECT generate_matches_for_lost($1)`,
  matchFound: `SELECT generate_matches_for_found($1)`,
  category: `SELECT requires_staff,is_sensitive FROM categories WHERE category_id=$1 AND is_active`,
  references: `SELECT 1 FROM locations WHERE location_id=$1 AND is_active`,
  top: (kind) =>
    `SELECT match_id,match_score,match_band FROM matches WHERE ${kinds[kind].id}=$1 ORDER BY match_score DESC LIMIT 1`,
  withdrawLock: `SELECT l.lost_id,l.status FROM lost_items l WHERE l.lost_id=$1 AND l.user_id=$2 FOR UPDATE`,
  withdraw: `UPDATE lost_items SET status='CLOSED_BY_USER',updated_at=NOW() WHERE lost_id=$1`,
  invalidate: `UPDATE matches SET status='INVALIDATED',updated_at=NOW() WHERE lost_id=$1 AND status IN ('SUGGESTED','CLAIMED')`,
  hasClaims: `SELECT 1 FROM claims c JOIN matches m USING(match_id) WHERE m.lost_id=$1 AND c.status IN ('PENDING','APPROVED','COMPLETED')`,
  updateLost: (data) => {
    const keys = Object.keys(data);
    return `UPDATE lost_items SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(",")},updated_at=NOW() WHERE lost_id=$${keys.length + 1}`;
  },
  invalidateSuggested: `UPDATE matches SET status='INVALIDATED',updated_at=NOW() WHERE lost_id=$1 AND status='SUGGESTED'`,
  reactivate: `UPDATE matches SET status='SUGGESTED' WHERE lost_id=$1 AND status='INVALIDATED' AND found_id IN (SELECT found_id FROM found_items WHERE status='AVAILABLE')`,
};
