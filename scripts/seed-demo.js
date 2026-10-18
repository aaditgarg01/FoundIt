require("dotenv").config({ quiet: true });
const bcrypt = require("bcrypt");
const { pool, withTransaction } = require("../src/db");
const Q = require("../db/queries/items");
const { randomBytes } = require("crypto");
async function main() {
  const password =
    process.env.DEMO_PASSWORD || randomBytes(12).toString("base64url");
  const hash = await bcrypt.hash(password, 12);
  await withTransaction(async (c) => {
    const users = {};
    for (const [email, name, role] of [
      ["ananya@demo.foundit.test", "Ananya Sharma", "STUDENT"],
      ["rahul@demo.foundit.test", "Rahul Mehta", "STUDENT"],
      ["security@demo.foundit.test", "Campus Security", "STAFF"],
      ["admin@demo.foundit.test", "Campus Administrator", "ADMIN"],
    ]) {
      const r = await c.query(
        `INSERT INTO users(email,full_name,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING user_id`,
        [email, name, hash, role],
      );
      users[email] = r.rows[0].user_id;
    }
    const locations = (
      await c.query(
        "SELECT location_id FROM locations ORDER BY location_id LIMIT 6",
      )
    ).rows;
    const items = [
      [
        "Earphones/Headphones",
        "Apple",
        "White",
        "AirPods in a white case",
        "Small blue star inside the lid",
      ],
      [
        "Water Bottle",
        "Milton",
        "Blue",
        "Blue steel water bottle",
        "The initials AS are engraved on the base",
      ],
      [
        "Keys",
        null,
        "Silver",
        "Keys with a canvas keychain",
        "Three keys and a tiny brass turtle",
      ],
      [
        "Backpack",
        "Wildcraft",
        "Black",
        "Black everyday backpack",
        "A green notebook in the inner pocket",
      ],
      [
        "Notebook",
        null,
        "Red",
        "Red spiral notebook",
        "Calculus notes with a flower on page twelve",
      ],
      [
        "Umbrella",
        null,
        "Navy",
        "Navy folding umbrella",
        "A small patch sewn beside the handle",
      ],
    ];
    let n = 0;
    for (const [category, brand, colour, name, privateFeature] of items) {
      if (
        (
          await c.query(
            "SELECT 1 FROM found_items WHERE user_id=$1 AND item_name=$2",
            [users["rahul@demo.foundit.test"], name],
          )
        ).rowCount
      )
        continue;
      const category_id = (
        await c.query(
          "SELECT category_id FROM categories WHERE category_name=$1",
          [category],
        )
      ).rows[0].category_id;
      const brand_id = brand
        ? (
            await c.query("SELECT brand_id FROM brands WHERE brand_name=$1", [
              brand,
            ])
          ).rows[0].brand_id
        : null;
      const colour_id = (
        await c.query("SELECT colour_id FROM colours WHERE colour_name=$1", [
          colour,
        ])
      ).rows[0].colour_id;
      const day = new Date();
      day.setDate(day.getDate() - 1 - (n % 3));
      const found_date = day.toISOString().slice(0, 10);
      const data = {
        category_id,
        location_id: locations[n % locations.length].location_id,
        brand_id,
        colour_id,
        item_name: name,
        description: `${colour} ${category.toLowerCase()}, found on campus and kept safe.`,
        private_feature: privateFeature,
        custody: "WITH_FINDER",
        found_date,
      };
      const row = (
        await c.query(Q.insert("found", data, users["rahul@demo.foundit.test"]))
      ).rows[0];
      await c.query(Q.matchFound, [row.found_id]);
      if (n === 0) {
        const { private_feature, custody, found_date, ...lost } = data;
        lost.lost_date = found_date;
        const l = (
          await c.query(
            Q.insert("lost", lost, users["ananya@demo.foundit.test"]),
          )
        ).rows[0];
        await c.query(Q.matchLost, [l.lost_id]);
      }
      n++;
    }
  });
  console.log(
    "Demo data ready. These accounts are for local demonstration only:",
  );
  console.log("ananya@demo.foundit.test (owner)");
  console.log("rahul@demo.foundit.test (finder)");
  console.log("security@demo.foundit.test (staff)");
  console.log("admin@demo.foundit.test (admin)");
  console.log("Demo password: " + password);
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
