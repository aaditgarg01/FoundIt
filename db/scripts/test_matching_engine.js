require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    await client.query('BEGIN');
    
    // Setup users, categories, locations, brands, colours
    const user1 = (await client.query("INSERT INTO users (full_name, email, role, password_hash) VALUES ('Test1', 't1@example.com', 'STUDENT', 'x') RETURNING user_id")).rows[0].user_id;
    const user2 = (await client.query("INSERT INTO users (full_name, email, role, password_hash) VALUES ('Test2', 't2@example.com', 'STUDENT', 'x') RETURNING user_id")).rows[0].user_id;
    
    const cat1 = (await client.query("SELECT category_id FROM categories LIMIT 1")).rows[0].category_id;
    const cat2 = (await client.query("SELECT category_id FROM categories WHERE category_id <> $1 LIMIT 1", [cat1])).rows[0].category_id;
    
    const loc1 = (await client.query("SELECT location_id FROM locations LIMIT 1")).rows[0].location_id;
    const loc2 = (await client.query("SELECT location_id FROM locations WHERE location_id <> $1 LIMIT 1", [loc1])).rows[0].location_id;
    
    const brand1 = (await client.query("SELECT brand_id FROM brands LIMIT 1")).rows[0].brand_id;
    const col1 = (await client.query("SELECT colour_id FROM colours LIMIT 1")).rows[0].colour_id;
    
    const tests = [
      // 1. Perfect match (score 100)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        found: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        expectedScore: 100
      },
      // 2. Day gap 1 (score 98)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        found: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-02', str: 'alpha beta' },
        expectedScore: 98 // 100 - 2 (date: 15->13)
      },
      // 3. Day gap 2 (score 95)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        found: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-03', str: 'alpha beta' },
        expectedScore: 95 // 100 - 5 (date: 15->10)
      },
      // 4. Day gap 3-5 (score 91)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        found: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-05', str: 'alpha beta' },
        expectedScore: 91 // 100 - 9 (date: 15->6)
      },
      // 5. Day gap 6-14 (score 88)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        found: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-12', str: 'alpha beta' },
        expectedScore: 88 // 100 - 12 (date: 15->3)
      },
      // 6. Day gap > 14 (NO MATCH because outside window)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        found: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-06-12', str: 'alpha beta' },
        expectedScore: null
      },
      // 7. Found before lost (NO MATCH because outside window)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-02', str: 'alpha beta' },
        found: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        expectedScore: null
      },
      // 8. Different Category (fails anchor predicate)
      // Wait, anchor predicate: category_id match OR (location_id match AND colour_id match)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        found: { cat: cat2, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        expectedScore: 80 // 100 - 20 (cat: 20->0)
      },
      // 9. Different Category, Different Location, Different Colour (fails anchor predicate entirely)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        found: { cat: cat2, loc: loc2, brand: brand1, col: null, date: '2026-05-01', str: 'alpha beta' },
        expectedScore: null // No match row should be generated
      },
      // 10. All optionals null (Score: Cat=20, Loc=20, Date=15, Desc=10 = 65)
      {
        lost: { cat: cat1, loc: loc1, brand: null, col: null, date: '2026-05-01', str: 'alpha beta' },
        found: { cat: cat1, loc: loc1, brand: null, col: null, date: '2026-05-01', str: 'alpha beta' },
        expectedScore: 65
      },
      // 11. Desc match 1 token + 'item' (Score: 100)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha gamma' },
        found: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha delta' },
        expectedScore: 100
      },
      // 12. Desc match 0 tokens + 'item' (Score: 100 - 5 = 95)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'epsilon zeta' },
        found: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha delta' },
        expectedScore: 95
      },
      // 13. Same user (should not match!)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta', user: user1 },
        found: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta', user: user1 },
        expectedScore: null
      },
      // 14. Different Brand (Score: 100 - 20 = 80)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        found: { cat: cat1, loc: loc1, brand: null, col: col1, date: '2026-05-01', str: 'alpha beta' },
        expectedScore: 80
      },
      // 15. Different Location (Score: 100 - 20 = 80)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        found: { cat: cat1, loc: loc2, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        expectedScore: 80
      },
      // 16. Different Colour (Score: 100 - 15 = 85)
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta' },
        found: { cat: cat1, loc: loc1, brand: brand1, col: null, date: '2026-05-01', str: 'alpha beta' },
        expectedScore: 85
      },
      // 17. Exactly at floor (Score = 40) -> Cat=20, Date=15, Desc=5, Loc=0, Brand=0, Col=0 -> 40
      // Assuming floor is 30.
      {
        lost: { cat: cat1, loc: loc1, brand: null, col: null, date: '2026-05-01', str: 'epsilon zeta' },
        found: { cat: cat1, loc: loc2, brand: null, col: null, date: '2026-05-01', str: 'alpha delta' },
        expectedScore: 40
      },
      // 18. Alternative anchor (Loc+Col). Score 43 -> Loc=20, Col=15, Date=3, Desc=5 -> 43.
      {
        lost: { cat: cat1, loc: loc1, brand: null, col: col1, date: '2026-05-01', str: 'epsilon zeta' },
        found: { cat: cat2, loc: loc1, brand: null, col: col1, date: '2026-05-15', str: 'alpha delta' },
        expectedScore: 43
      },
      // 19. Below floor (Score = 20) -> Cat=20, Date=0, Desc=0, Loc=0, Brand=0, Col=0.
      {
        lost: { cat: cat1, loc: loc1, brand: null, col: null, date: '2026-05-01', str: 'epsilon zeta' },
        found: { cat: cat1, loc: loc2, brand: null, col: null, date: '2026-06-12', str: 'alpha delta' },
        expectedScore: null // 20 is below floor!
      },
      // 20. Over 100 -> Cat=20, Brand=20, Loc=20, Col=15, Date=15, Desc=20 (Wait desc cap is 10). So max is 100.
      {
        lost: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta gamma delta epsilon zeta' },
        found: { cat: cat1, loc: loc1, brand: brand1, col: col1, date: '2026-05-01', str: 'alpha beta gamma delta epsilon zeta' },
        expectedScore: 100
      }
    ];

    let passed = 0;
    let failed = 0;

    for (let i = 0; i < tests.length; i++) {
      const t = tests[i];
      
      const l = t.lost;
      const l_res = await client.query(`
        INSERT INTO lost_items (user_id, category_id, location_id, brand_id, colour_id, lost_date, item_name, description)
        VALUES ($1, $2, $3, $4, $5, $6, 'Lost Item', $7) RETURNING lost_id
      `, [l.user || user1, l.cat, l.loc, l.brand, l.col, l.date, l.str]);
      const lost_id = l_res.rows[0].lost_id;

      const f = t.found;
      const f_res = await client.query(`
        INSERT INTO found_items (user_id, category_id, location_id, brand_id, colour_id, found_date, item_name, description, private_feature, custody)
        VALUES ($1, $2, $3, $4, $5, $6, 'Found Item', $7, 'feature', 'WITH_FINDER') RETURNING found_id
      `, [f.user || user2, f.cat, f.loc, f.brand, f.col, f.date, f.str]);
      const found_id = f_res.rows[0].found_id;

      await client.query("SELECT generate_matches_for_lost($1)", [lost_id]);

      const m_res = await client.query("SELECT match_score FROM matches WHERE lost_id = $1 AND found_id = $2", [lost_id, found_id]);
      
      if (t.expectedScore === null) {
        if (m_res.rows.length === 0) {
          console.log(`✅ Pair ${i+1}: Correctly generated no match (below floor or constraint)`);
          passed++;
        } else {
          console.log(`❌ Pair ${i+1}: Expected NO MATCH, got score ${m_res.rows[0].match_score}`);
          failed++;
        }
      } else {
        if (m_res.rows.length === 0) {
          console.log(`❌ Pair ${i+1}: Expected score ${t.expectedScore}, got NO MATCH`);
          failed++;
        } else {
          const actualScore = m_res.rows[0].match_score;
          if (actualScore === t.expectedScore) {
            console.log(`✅ Pair ${i+1}: Score matched exactly ${actualScore}`);
            passed++;
          } else {
            console.log(`❌ Pair ${i+1}: Expected ${t.expectedScore}, got ${actualScore}`);
            
            // Debug the score JSON
            const dbg = await client.query("SELECT reason_json FROM matches WHERE lost_id = $1 AND found_id = $2", [lost_id, found_id]);
            console.log("   Reason: " + JSON.stringify(dbg.rows[0].reason_json));
            
            failed++;
          }
        }
      }
    }

    console.log(`\nMatching Engine Verification: ${passed} passed, ${failed} failed`);

  } catch (err) {
    console.error(err);
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}

run();
