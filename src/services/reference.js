const { pool } = require('../db');

let cache = {
  categories: [],
  locations: [],
  brands: [],
  colours: [],
  lastUpdated: null
};

async function reloadCache() {
  const categoriesRes = await pool.query('SELECT * FROM categories ORDER BY category_name');
  const locationsRes = await pool.query('SELECT * FROM locations ORDER BY location_name');
  const brandsRes = await pool.query('SELECT * FROM brands WHERE is_active = true ORDER BY brand_name');
  const coloursRes = await pool.query('SELECT * FROM colours ORDER BY colour_name');

  cache = {
    categories: categoriesRes.rows,
    locations: locationsRes.rows,
    brands: brandsRes.rows,
    colours: coloursRes.rows,
    lastUpdated: new Date()
  };
}

async function getCache() {
  if (!cache.lastUpdated) {
    await reloadCache();
  }
  return cache;
}

module.exports = {
  reloadCache,
  getCache
};
