const { Client } = require('pg');
const fs = require('fs');

// --- Seeded PRNG ---
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Parse args
const args = process.argv.slice(2);
let numLost = 1000;
let numFound = 400;
let seed = 12345;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--lost') numLost = parseInt(args[i+1], 10);
  if (args[i] === '--found') numFound = parseInt(args[i+1], 10);
  if (args[i] === '--seed') seed = parseInt(args[i+1], 10);
}

const random = mulberry32(seed);

// --- Distributions (Amendment 2d) ---
const CATEGORY_WEIGHTS = {
  'Mobile Phone': 20,
  'Earphones/Headphones': 18,
  'Water Bottle': 15,
  'Identity Document': 10,
  'Laptop': 8,
  'Keys': 8,
  'Wallet/Purse': 6,
  'Notebook': 4,
  'Umbrella': 4,
  'Jacket': 2,
  'Backpack': 2,
  'Watch': 1,
  'Jewellery': 1,
  'Other': 1
};

const ITEM_NAMES = {
  'Mobile Phone': ['iPhone 13', 'Galaxy S22', 'Pixel 7', 'phone', 'handset', 'mobile'],
  'Water Bottle': ['steel flask', 'sipper', 'thermos', 'bottle'],
  'Earphones/Headphones': ['airpods', 'headphones', 'earbuds', 'headset', 'sony earphones'],
  'Identity Document': ['ID card', 'passport', 'driver license', 'student ID'],
  'Laptop': ['macbook pro', 'thinkpad', 'dell xps', 'laptop', 'notebook computer'],
  'Keys': ['house keys', 'car key', 'bunch of keys', 'hostel key'],
  'Wallet/Purse': ['leather wallet', 'purse', 'cardholder'],
  'Notebook': ['spiral notebook', 'lab manual', 'notepad', 'diary'],
  'Umbrella': ['black umbrella', 'folding umbrella', 'parasol'],
  'Jacket': ['denim jacket', 'hoodie', 'windbreaker', 'winter coat'],
  'Backpack': ['school bag', 'rucksack', 'laptop bag'],
  'Watch': ['smartwatch', 'analog watch', 'digital watch', 'apple watch'],
  'Jewellery': ['gold ring', 'silver chain', 'bracelet', 'earring'],
  'Other': ['glasses', 'sunglasses', 'calculator', 'charger']
};

const FILLER = [
  'slightly worn', 'has a small dent', 'a bit scratched', 'looks fairly new',
  'has a sticker on it', 'the strap is frayed', 'there is a chip on one corner',
  'pretty old', 'in good condition', 'well used', 'has a cover', 'screen is cracked',
  'dirty', 'very clean'
];


const locationsConfig = JSON.parse(fs.readFileSync('db/data/locations_config.json'));
const LOCATION_WEIGHTS = {};
for (const loc of locationsConfig) {
  LOCATION_WEIGHTS[loc.name] = loc.weight;
}

function weightedChoice(weightsObj) {
  const keys = Object.keys(weightsObj);
  const total = keys.reduce((acc, k) => acc + weightsObj[k], 0);
  let r = random() * total;
  for (const k of keys) {
    r -= weightsObj[k];
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://foundit_user:foundit_password@localhost:5432/foundit'
  });
  await client.connect();

  try {
    // Fetch reference data
    const catRes = await client.query('SELECT category_id, category_name FROM categories');
    const categories = catRes.rows.reduce((acc, row) => { acc[row.category_name] = row.category_id; return acc; }, {});

    const locRes = await client.query('SELECT location_id, location_name FROM locations');
    const locationIdsByName = locRes.rows.reduce((acc, row) => {
      acc[row.location_name] = row.location_id;
      return acc;
    }, {});

    const colRes = await client.query('SELECT colour_id FROM colours');
    const colourIds = colRes.rows.map(r => r.colour_id);

    const brandRes = await client.query('SELECT brand_id FROM brands');
    const brandIds = brandRes.rows.map(r => r.brand_id);

    // Ensure we have users
    const userRes = await client.query('SELECT user_id FROM users');
    let userIds = userRes.rows.map(r => r.user_id);
    if (userIds.length < 10) {
      for (let i = 0; i < 20; i++) {
        const res = await client.query(
          `INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id`,
          [`User ${i}`, `user${i}@example.com`, '000000000000000000000000000000000000000000000000000000000000']
        );
        userIds.push(res.rows[0].user_id);
      }
    }

    const randomUser = () => userIds[Math.floor(random() * userIds.length)];
    const randomColour = () => random() < 0.3 ? null : colourIds[Math.floor(random() * colourIds.length)]; // 30% null
    const randomBrand = () => random() < 0.4 ? null : brandIds[Math.floor(random() * brandIds.length)]; // 40% null

    await client.query('BEGIN');

    // 1. Generate Lost Items
    console.log(`Generating ${numLost} lost items...`);
    const lostItems = [];
    const baseDate = new Date('2026-07-01T00:00:00Z');
    
    for (let i = 0; i < numLost; i++) {
      const catName = weightedChoice(CATEGORY_WEIGHTS);
      const categoryId = categories[catName] || Object.values(categories)[0];
      const locName = weightedChoice(LOCATION_WEIGHTS);
      const locationId = locationIdsByName[locName] || Object.values(locationIdsByName)[0];
      const colourId = randomColour();
      const brandId = randomBrand();
      const userId = randomUser();
      
      const dayOffset = Math.floor(random() * 20); // Clustered around 20 days
      const lostDate = new Date(baseDate);
      lostDate.setDate(lostDate.getDate() + dayOffset);
      const lostDateStr = lostDate.toISOString().split('T')[0];
      
      const itemNamesPool = ITEM_NAMES[catName] || ['item', 'object'];
      const itemName = itemNamesPool[Math.floor(random() * itemNamesPool.length)];
      
      const filler1 = FILLER[Math.floor(random() * FILLER.length)];
      let filler2 = FILLER[Math.floor(random() * FILLER.length)];
      while(filler1 === filler2) filler2 = FILLER[Math.floor(random() * FILLER.length)];
      const description = `${filler1}, ${filler2}.`;

      const res = await client.query(
        `INSERT INTO lost_items (user_id, item_name, category_id, location_id, colour_id, brand_id, description, lost_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING lost_id, user_id, category_id, location_id, colour_id, brand_id, lost_date, item_name, description`,
        [userId, itemName, categoryId, locationId, colourId, brandId, description, lostDateStr]
      );
      lostItems.push(res.rows[0]);
    }

    // 2. Generate Found Items
    console.log(`Generating ${numFound} found items...`);
    const derivedCount = Math.floor(numFound * 0.3); // 30% planted pairs
    const independentCount = numFound - derivedCount;
    
    const groundTruthPairs = [];

    // 2a. Derived Found Items (Planted Pairs)
    for (let i = 0; i < derivedCount; i++) {
      const sourceLost = lostItems[Math.floor(random() * lostItems.length)];
      
      // Ensure finder != loser
      let finderId = randomUser();
      while (finderId === sourceLost.user_id) finderId = randomUser();

      const r = random();
      let difficulty = 'EASY';
      if (r > 0.66) difficulty = 'HARD';
      else if (r > 0.33) difficulty = 'MEDIUM';

      let catId = sourceLost.category_id;
      let locId = sourceLost.location_id;
      let colId = sourceLost.colour_id;
      let brId = sourceLost.brand_id;
      
      let dayGap = 0;
      let desc = '';
      let fItemName = '';
      const sourcePool = ITEM_NAMES[Object.keys(categories).find(key => categories[key] === catId)] || ['item', 'object'];
      const lostFillers = sourceLost.description.split(', ').map(s => s.replace('.', ''));
      
      if (difficulty === 'EASY') {
        dayGap = Math.floor(random() * 2) + 1; // 1-2 days
        desc = `${lostFillers[0]}, ${lostFillers[1]}.`;
        fItemName = sourceLost.item_name;
      } else if (difficulty === 'MEDIUM') {
        dayGap = Math.floor(random() * 3) + 3; // 3-5 days
        if (random() > 0.5) colId = randomColour(); else brId = randomBrand();
        desc = `${lostFillers[0]}.`; // share one
        fItemName = sourcePool.find(n => n !== sourceLost.item_name) || sourcePool[0]; // different name from same pool
      } else { // HARD
        dayGap = Math.floor(random() * 9) + 6; // 6-14 days
        colId = random() > 0.5 ? null : randomColour();
        brId = random() > 0.5 ? null : randomBrand();
        let freshFiller = FILLER[Math.floor(random() * FILLER.length)];
        while (lostFillers.includes(freshFiller)) freshFiller = FILLER[Math.floor(random() * FILLER.length)];
        desc = `${freshFiller}.`; // share none
        fItemName = 'object'; // generic term
      }

      const foundDate = new Date(sourceLost.lost_date);
      foundDate.setDate(foundDate.getDate() + dayGap);
      const foundDateStr = foundDate.toISOString().split('T')[0];

      const res = await client.query(
        `INSERT INTO found_items (user_id, item_name, category_id, location_id, colour_id, brand_id, description, private_feature, custody, found_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING found_id`,
        [finderId, fItemName, catId, locId, colId, brId, desc, 'Secret mark', 'WITH_FINDER', foundDateStr]
      );
      
      groundTruthPairs.push({
        lost_id: sourceLost.lost_id,
        found_id: res.rows[0].found_id,
        difficulty: difficulty
      });
    }

    // 2b. Independent Found Items
    for (let i = 0; i < independentCount; i++) {
      const catName = weightedChoice(CATEGORY_WEIGHTS);
      const categoryId = categories[catName] || Object.values(categories)[0];
      const locName = weightedChoice(LOCATION_WEIGHTS);
      const locationId = locationIdsByName[locName] || Object.values(locationIdsByName)[0];
      const colourId = randomColour();
      const brandId = randomBrand();
      const userId = randomUser();
      
      const dayOffset = Math.floor(random() * 20);
      const foundDate = new Date(baseDate);
      foundDate.setDate(foundDate.getDate() + dayOffset);
      const foundDateStr = foundDate.toISOString().split('T')[0];
      
      const itemNamesPool = ITEM_NAMES[catName] || ['item', 'object'];
      const itemName = itemNamesPool[Math.floor(random() * itemNamesPool.length)];
      
      const filler1 = FILLER[Math.floor(random() * FILLER.length)];
      const description = `${filler1}.`;

      await client.query(
        `INSERT INTO found_items (user_id, item_name, category_id, location_id, colour_id, brand_id, description, private_feature, custody, found_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [userId, itemName, categoryId, locationId, colourId, brandId, description, 'Secret mark', 'WITH_FINDER', foundDateStr]
      );
    }

    fs.writeFileSync('db/data/ground_truth.json', JSON.stringify(groundTruthPairs, null, 2));
    console.log(`Wrote ${groundTruthPairs.length} planted pairs to db/data/ground_truth.json`);

    // Load ground_truth into a table for the assertion
    await client.query('DROP TABLE IF EXISTS ground_truth');
    await client.query('CREATE TABLE ground_truth (lost_id INT, found_id INT, difficulty VARCHAR)');
    
    if (groundTruthPairs.length > 0) {
      const values = groundTruthPairs.map((p, i) => `($${i*3 + 1}, $${i*3 + 2}, $${i*3 + 3})`).join(', ');
      const flatParams = groundTruthPairs.flatMap(p => [p.lost_id, p.found_id, p.difficulty]);
      await client.query(`INSERT INTO ground_truth (lost_id, found_id, difficulty) VALUES ${values}`, flatParams);
    }

    // Run matching engine for all lost items to simulate system behavior and trigger assertion
    console.log('Running matching engine...');
    for (const lost of lostItems) {
      await client.query(`SELECT generate_matches_for_lost($1)`, [lost.lost_id]);
    }

    // Row-count assertion
    const matchRes = await client.query('SELECT count(*) FROM matches');
    const matchCount = parseInt(matchRes.rows[0].count, 10);
    const maxMatches = numLost * 8;
    console.log(`Matches generated: ${matchCount} (Max allowed: ${maxMatches})`);
    
    // Planted fraction assertion
    const plantedRes = await client.query(`
      SELECT count(*) AS planted FROM matches m
      WHERE EXISTS (SELECT 1 FROM ground_truth g
                     WHERE g.lost_id = m.lost_id
                       AND g.found_id = m.found_id)
    `);
    const plantedCount = parseInt(plantedRes.rows[0].planted, 10);
    const plantedFraction = matchCount > 0 ? (plantedCount / matchCount) : 0;
    console.log(`Planted matches: ${plantedCount} / ${matchCount} (${(plantedFraction * 100).toFixed(2)}%)`);

    if (matchCount > maxMatches) {
      throw new Error(`RK-4 TRIPWIRE TRIPPED: Match count ${matchCount} exceeds 8x lost items limit (${maxMatches})`);
    }
    
    if (plantedFraction < 0.01) {
       throw new Error(`PLANTED FRACTION TRIPWIRE TRIPPED: Planted matches are less than 1% of total matches (${(plantedFraction * 100).toFixed(2)}%)`);
    }
    
    await client.query('COMMIT');
    
    // Extra Stats for Verification
    console.log('--- SEED DATA VERIFICATION ---');
    const counts = await client.query("SELECT (SELECT COUNT(*) FROM lost_items) AS lost, (SELECT COUNT(*) FROM found_items) AS found, (SELECT COUNT(*) FROM matches) AS matches");
    console.log(`Counts: Lost=${counts.rows[0].lost}, Found=${counts.rows[0].found}, Matches=${counts.rows[0].matches}`);

    const locDist = await client.query("SELECT l.zone, l.building, COUNT(f.found_id) as count FROM found_items f JOIN locations l ON f.location_id = l.location_id GROUP BY l.zone, l.building ORDER BY count DESC LIMIT 5");
    console.log('Top 5 Found Item Locations:');
    locDist.rows.forEach(r => console.log(`  ${r.building} (${r.zone}): ${r.count}`));

    const catDist = await client.query("SELECT c.category_name, COUNT(l.lost_id) as count FROM lost_items l JOIN categories c ON l.category_id = c.category_id GROUP BY c.category_name ORDER BY count DESC LIMIT 5");
    console.log('Top 5 Lost Item Categories:');
    catDist.rows.forEach(r => console.log(`  ${r.category_name}: ${r.count}`));

    const nullBrand = await client.query("SELECT ROUND(COUNT(*) FILTER (WHERE brand_id IS NULL AND brand_other IS NULL) * 100.0 / COUNT(*), 2) as pct FROM found_items");
    const nullColor = await client.query("SELECT ROUND(COUNT(*) FILTER (WHERE colour_id IS NULL) * 100.0 / COUNT(*), 2) as pct FROM found_items");
    console.log(`Null Fractions: Brand=${nullBrand.rows[0].pct}%, Colour=${nullColor.rows[0].pct}%`);

    console.log('Synthetic data generated successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding data:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
