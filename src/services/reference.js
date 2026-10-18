const { pool } = require("../db");
const Q = require("../../db/queries/reference");
async function getCache() {
  const keys = Object.keys(Q.tables);
  const rows = await Promise.all(keys.map((k) => pool.query(Q.all(k))));
  return Object.fromEntries(keys.map((k, i) => [k, rows[i].rows]));
}
module.exports = { getCache, reloadCache: getCache };
