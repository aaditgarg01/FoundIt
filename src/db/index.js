const { Pool, types } = require("pg");

// A campus calendar date is not an instant. Preserve DATE values across time zones.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
async function withTransaction(callback, actorId = null) {
  const client = await pool.connect();
  let result;
  try {
    await client.query("BEGIN");
    if (actorId)
      await client.query("SELECT set_config('app.actor_id', $1, true)", [
        String(actorId),
      ]);
    result = await callback(client);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return result;
}

module.exports = {
  pool,
  query,
  withTransaction,
};
