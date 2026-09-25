const fs = require('fs');
let content = fs.readFileSync('db/scripts/seed_data.js', 'utf8');

const target = "console.log('Synthetic data generated successfully.');";
const replacement = `
    // Extra Stats for Verification
    console.log('--- SEED DATA VERIFICATION ---');
    const counts = await client.query("SELECT (SELECT COUNT(*) FROM lost_items) AS lost, (SELECT COUNT(*) FROM found_items) AS found, (SELECT COUNT(*) FROM matches) AS matches");
    console.log(\`Counts: Lost=\${counts.rows[0].lost}, Found=\${counts.rows[0].found}, Matches=\${counts.rows[0].matches}\`);

    const locDist = await client.query("SELECT l.zone, l.building, COUNT(f.found_id) as count FROM found_items f JOIN locations l ON f.location_id = l.location_id GROUP BY l.zone, l.building ORDER BY count DESC LIMIT 5");
    console.log('Top 5 Found Item Locations:');
    locDist.rows.forEach(r => console.log(\`  \${r.building} (\${r.zone}): \${r.count}\`));

    const catDist = await client.query("SELECT c.category_name, COUNT(l.lost_id) as count FROM lost_items l JOIN categories c ON l.category_id = c.category_id GROUP BY c.category_name ORDER BY count DESC LIMIT 5");
    console.log('Top 5 Lost Item Categories:');
    catDist.rows.forEach(r => console.log(\`  \${r.category_name}: \${r.count}\`));

    const nullBrand = await client.query("SELECT ROUND(COUNT(*) FILTER (WHERE brand_id IS NULL AND brand_other IS NULL) * 100.0 / COUNT(*), 2) as pct FROM found_items");
    const nullColor = await colourId ? await client.query("SELECT ROUND(COUNT(*) FILTER (WHERE colour_id IS NULL) * 100.0 / COUNT(*), 2) as pct FROM found_items") : {rows: [{pct: 'N/A'}]};
    console.log(\`Null Fractions: Brand=\${nullBrand.rows[0].pct}%\`);

    ` + target;

content = content.replace(target, replacement);
fs.writeFileSync('db/scripts/seed_data.js', content);
