const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Execute a query using the connection pool
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Execute a callback inside a transaction.
 * The callback receives a client which MUST be used for all queries within the transaction.
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  let result;
  try {
    await client.query('BEGIN');
    result = await callback(client);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return result;
}

module.exports = {
  pool,
  query,
  withTransaction
};
