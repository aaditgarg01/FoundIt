const app = require("./app");
const { pool } = require("./db");
const server = app.listen(process.env.PORT || 3000, () =>
  console.log(
    `FoundIt is ready at http://localhost:${process.env.PORT || 3000}`,
  ),
);
async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
