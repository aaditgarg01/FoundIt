require("dotenv").config({ quiet: true });
const { pool, withTransaction } = require("../src/db");
async function expire() {
  const result = await withTransaction(async (c) =>
    c.query(
      `WITH stale AS (SELECT l.lost_id FROM lost_items l WHERE l.status='OPEN' AND l.created_at<NOW()-make_interval(days=>(SELECT config_value FROM match_config WHERE config_key='RETENTION_DAYS')) AND NOT EXISTS(SELECT 1 FROM claims c JOIN matches m USING(match_id) WHERE m.lost_id=l.lost_id AND c.status IN ('PENDING','APPROVED')) ORDER BY l.lost_id LIMIT 500 FOR UPDATE OF l SKIP LOCKED), expired AS (UPDATE lost_items SET status='EXPIRED',updated_at=NOW() WHERE lost_id IN(SELECT lost_id FROM stale) RETURNING lost_id) UPDATE matches SET status='INVALIDATED',updated_at=NOW() WHERE lost_id IN(SELECT lost_id FROM expired) AND status IN('SUGGESTED','CLAIMED') RETURNING lost_id`,
    ),
  );
  console.log(`Expiry run complete. ${result.rowCount} matches invalidated.`);
}
if (require.main === module)
  expire()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
module.exports = expire;
