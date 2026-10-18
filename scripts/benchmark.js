require("dotenv").config({ quiet: true });
const { pool, withTransaction } = require("../src/db");
const { performance } = require("perf_hooks");
const rollback = Object.assign(new Error("ROLLBACK_BENCHMARK"), {
  expected: true,
});
async function main() {
  if (!new URL(process.env.DATABASE_URL).pathname.endsWith("_test"))
    throw new Error(
      "Benchmark requires a disposable database ending in _test.",
    );
  try {
    await withTransaction(async (c) => {
      for (const kind of ["lost", "found"]) {
        const id = kind + "_id",
          table = kind + "_items";
        const count = Number(
          (await c.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n,
        );
        if (!count) throw new Error("Seed the evaluation dataset first.");
        const columns = [
          "user_id",
          "item_name",
          "category_id",
          "location_id",
          "colour_id",
          "brand_id",
          "description",
          kind + "_date",
          ...(kind === "found" ? ["private_feature", "custody"] : []),
        ];
        if (count < 10000)
          await c.query(
            `WITH source AS(SELECT *,row_number() OVER(ORDER BY ${id}) AS n FROM ${table}) INSERT INTO ${table}(${columns.join(",")}) SELECT ${columns.map((x) => "s." + x).join(",")} FROM generate_series(1,$1::int) g JOIN source s ON s.n=1+(g-1)%$2::int`,
            [10000 - count, count],
          );
        await c.query(`ANALYZE ${table}`);
      }
      console.log(
        "Benchmark dataset: 10000 lost items, 10000 found items. All benchmark changes roll back.",
      );
      const id = (
        await c.query("SELECT lost_id FROM lost_items ORDER BY lost_id LIMIT 1")
      ).rows[0].lost_id;
      const samples = [];
      for (let n = 0; n < 10; n++) {
        const start = performance.now();
        await c.query("SELECT generate_matches_for_lost($1)", [id]);
        if (n) samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      console.log(
        `Lost-anchor matching median (9 measured runs after warmup): ${samples[4].toFixed(2)} ms`,
      );
      const plan = await c.query(
        "EXPLAIN (ANALYZE,BUFFERS) SELECT generate_matches_for_lost($1)",
        [id],
      );
      for (const row of plan.rows) console.log(row["QUERY PLAN"]);
      throw rollback;
    });
  } catch (e) {
    if (e !== rollback) throw e;
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
