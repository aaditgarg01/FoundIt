require("dotenv").config({ quiet: true });
const fs = require("fs"),
  { pool } = require("../src/db");
async function main() {
  const truth = JSON.parse(
    fs.readFileSync("db/data/ground_truth.json", "utf8"),
  );
  if (!truth.length) throw new Error("Seed an evaluation dataset first.");
  const { rows } = await pool.query(
    `WITH truth AS(SELECT * FROM jsonb_to_recordset($1::jsonb) AS t(lost_id integer,found_id integer)),ranked AS(SELECT m.*,row_number() OVER(PARTITION BY lost_id ORDER BY match_score DESC,match_id) AS rank FROM matches m),strong AS(SELECT m.* FROM matches m WHERE match_band='STRONG') SELECT (SELECT count(*)::int FROM truth) AS planted,(SELECT count(*)::int FROM truth t JOIN ranked m USING(lost_id,found_id) WHERE m.rank<=3) AS recovered_top3,(SELECT count(*)::int FROM strong) AS strong_candidates,(SELECT count(*)::int FROM strong m JOIN truth t USING(lost_id,found_id)) AS strong_true`,
    [JSON.stringify(truth)],
  );
  const d = rows[0];
  console.log(
    JSON.stringify(
      {
        ...d,
        recall_at_3: Number(((100 * d.recovered_top3) / d.planted).toFixed(2)),
        strong_precision: d.strong_candidates
          ? Number(((100 * d.strong_true) / d.strong_candidates).toFixed(2))
          : 0,
      },
      null,
      2,
    ),
  );
  if (
    d.recovered_top3 / d.planted < 0.85 ||
    d.strong_true / Math.max(1, d.strong_candidates) < 0.7
  )
    process.exitCode = 1;
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
