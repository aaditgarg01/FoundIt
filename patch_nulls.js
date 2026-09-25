const fs = require('fs');
let content = fs.readFileSync('db/scripts/seed_data.js', 'utf8');

content = content.replace(
  "const nullColor = await colourId ? await client.query(\"SELECT ROUND(COUNT(*) FILTER (WHERE colour_id IS NULL) * 100.0 / COUNT(*), 2) as pct FROM found_items\") : {rows: [{pct: 'N/A'}]};",
  "const nullColor = await client.query(\"SELECT ROUND(COUNT(*) FILTER (WHERE colour_id IS NULL) * 100.0 / COUNT(*), 2) as pct FROM found_items\");"
);
content = content.replace(
  "console.log(`Null Fractions: Brand=${nullBrand.rows[0].pct}%`);",
  "console.log(`Null Fractions: Brand=${nullBrand.rows[0].pct}%, Colour=${nullColor.rows[0].pct}%`);"
);
fs.writeFileSync('db/scripts/seed_data.js', content);
