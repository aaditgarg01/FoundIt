require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function seedReference() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://foundit_user:foundit_password@localhost:5432/foundit'
  });
  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. Categories
    const categories = [
      { name: 'Electronics', requires_staff: false, is_sensitive: false },
      { name: 'Laptop', requires_staff: true, is_sensitive: false, parent: 'Electronics' },
      { name: 'Mobile Phone', requires_staff: true, is_sensitive: false, parent: 'Electronics' },
      { name: 'Earphones/Headphones', requires_staff: false, is_sensitive: false, parent: 'Electronics' },
      { name: 'Documents', requires_staff: false, is_sensitive: false },
      { name: 'Identity Document', requires_staff: true, is_sensitive: true, parent: 'Documents' },
      { name: 'Notebook', requires_staff: false, is_sensitive: false, parent: 'Documents' },
      { name: 'Accessories', requires_staff: false, is_sensitive: false },
      { name: 'Jewellery', requires_staff: true, is_sensitive: false, parent: 'Accessories' },
      { name: 'Watch', requires_staff: false, is_sensitive: false, parent: 'Accessories' },
      { name: 'Bags', requires_staff: false, is_sensitive: false },
      { name: 'Backpack', requires_staff: false, is_sensitive: false, parent: 'Bags' },
      { name: 'Handbag', requires_staff: false, is_sensitive: false, parent: 'Bags' },
      { name: 'Clothing', requires_staff: false, is_sensitive: false },
      { name: 'Jacket', requires_staff: false, is_sensitive: false, parent: 'Clothing' },
      { name: 'Keys', requires_staff: false, is_sensitive: false },
      { name: 'Water Bottle', requires_staff: false, is_sensitive: false },
      { name: 'Umbrella', requires_staff: false, is_sensitive: false },
      { name: 'Wallet/Purse', requires_staff: false, is_sensitive: false },
      { name: 'Other', requires_staff: false, is_sensitive: false }
    ];

    for (const cat of categories.filter(c => !c.parent)) {
      await client.query(
        `INSERT INTO categories (category_name, requires_staff, is_sensitive) 
         VALUES ($1, $2, $3) ON CONFLICT (category_name) DO NOTHING`,
        [cat.name, cat.requires_staff, cat.is_sensitive]
      );
    }
    for (const cat of categories.filter(c => c.parent)) {
      await client.query(
        `INSERT INTO categories (category_name, requires_staff, is_sensitive, parent_id) 
         VALUES ($1, $2, $3, (SELECT category_id FROM categories WHERE category_name = $4)) 
         ON CONFLICT (category_name) DO NOTHING`,
        [cat.name, cat.requires_staff, cat.is_sensitive, cat.parent]
      );
    }

    // 2. Locations (simplified to 75 specific locations with individual weights)
    const locations = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/locations_config.json')));
    for (const loc of locations) {
      await client.query(
        `INSERT INTO locations (location_name, building, zone) 
         VALUES ($1, $2, $3) ON CONFLICT (location_name, building) DO NOTHING`,
        [loc.name, loc.building, loc.zone]
      );
    }

    // 3. Colours (25 colours)
    const colours = [
      { name: 'Black', hex: '#000000' }, { name: 'White', hex: '#FFFFFF' },
      { name: 'Red', hex: '#FF0000' }, { name: 'Green', hex: '#00FF00' },
      { name: 'Blue', hex: '#0000FF' }, { name: 'Yellow', hex: '#FFFF00' },
      { name: 'Cyan', hex: '#00FFFF' }, { name: 'Magenta', hex: '#FF00FF' },
      { name: 'Silver', hex: '#C0C0C0' }, { name: 'Gray', hex: '#808080' },
      { name: 'Maroon', hex: '#800000' }, { name: 'Olive', hex: '#808000' },
      { name: 'Purple', hex: '#800080' }, { name: 'Teal', hex: '#008080' },
      { name: 'Navy', hex: '#000080' }, { name: 'Orange', hex: '#FFA500' },
      { name: 'Pink', hex: '#FFC0CB' }, { name: 'Brown', hex: '#A52A2A' },
      { name: 'Gold', hex: '#FFD700' }, { name: 'Beige', hex: '#F5F5DC' },
      { name: 'Ivory', hex: '#FFFFF0' }, { name: 'Coral', hex: '#FF7F50' },
      { name: 'Violet', hex: '#EE82EE' }, { name: 'Indigo', hex: '#4B0082' },
      { name: 'Turquoise', hex: '#40E0D0' }
    ];
    for (const c of colours) {
      await client.query(
        `INSERT INTO colours (colour_name, hex_value) VALUES ($1, $2) ON CONFLICT (colour_name) DO NOTHING`,
        [c.name, c.hex]
      );
    }

    // 4. Brands (60 specific brands + 'Other / Unknown')
    const brands = [
      'Apple', 'Samsung', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'Sony',
      'Nike', 'Adidas', 'Puma', 'Reebok', 'Under Armour', 'Vans', 'Converse',
      'Fossil', 'Casio', 'Rolex', 'Seiko', 'Citizen', 'Timex', 'Titan',
      'Wildcraft', 'American Tourister', 'Skybags', 'VIP', 'Safari',
      'Milton', 'Cello', 'Tupperware', 'Hydro Flask', 'Yeti',
      'Fastrack', 'Ray-Ban', 'Oakley', 'Gucci', 'Prada',
      'Boat', 'JBL', 'Bose', 'Sennheiser', 'Skullcandy',
      'Logitech', 'Microsoft', 'Razer', 'Corsair',
      'Zara', 'H&M', "Levi's", 'Polo Ralph Lauren', 'Tommy Hilfiger', 'Garmin', 'Decathlon',
      'OnePlus', 'Xiaomi', 'Oppo', 'Vivo', 'Realme', 'Google', 'Nothing',
      'Other / Unknown'
    ];
    for (const brand of brands) {
      await client.query(
        `INSERT INTO brands (brand_name) VALUES ($1) ON CONFLICT (brand_name) DO NOTHING`,
        [brand]
      );
    }

    // 5. Score bands (3 bands)
    await client.query(`INSERT INTO score_bands (band_name, lower_bound, upper_bound) VALUES ('WEAK', 0, 59) ON CONFLICT (band_name) DO NOTHING`);
    await client.query(`INSERT INTO score_bands (band_name, lower_bound, upper_bound) VALUES ('POSSIBLE', 60, 79) ON CONFLICT (band_name) DO NOTHING`);
    await client.query(`INSERT INTO score_bands (band_name, lower_bound, upper_bound) VALUES ('STRONG', 80, 100) ON CONFLICT (band_name) DO NOTHING`);

    // 6. Config rows (12 keys)
    const configs = [
      ['W_CATEGORY', 20, 'Category match weight'],
      ['W_BRAND', 20, 'Brand match weight'],
      ['W_LOCATION', 20, 'Location match weight'],
      ['W_COLOUR', 15, 'Colour match weight'],
      ['W_DATE_MAX', 15, 'Max temporal proximity weight'],
      ['W_DESC_MAX', 10, 'Max description overlap weight'],
      ['T_STRONG', 80, 'Threshold for STRONG match'],
      ['T_POSSIBLE', 60, 'Threshold for POSSIBLE match'],
      ['T_FLOOR', 40, 'Minimum score to generate a match'],
      ['DATE_WINDOW_DAYS', 30, 'Max days found item can post-date lost item'],
      ['RETENTION_DAYS', 90, 'Days to retain uncollected items'],
      ['MAX_PENDING_CLAIMS', 3, 'Max pending claims allowed per user']
    ];
    for (const [key, val, desc] of configs) {
      await client.query(
        `INSERT INTO match_config (config_key, config_value, description) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (config_key) DO NOTHING`,
        [key, val, desc]
      );
    }

    await client.query('COMMIT');
    console.log('Reference data seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding reference data:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedReference();
