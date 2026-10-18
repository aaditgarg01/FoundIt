require("dotenv").config({ quiet: true });
const express = require("express"),
  cors = require("cors"),
  path = require("node:path");
const { loggerMiddleware, errorHandler, rateLimit } = require("./middlewares");
const app = express();
app.disable("x-powered-by");
if (process.env.VERCEL) app.set("trust proxy", 1);
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'",
  );
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use(loggerMiddleware);
app.use((req, res, next) => {
  req.body ??= {};
  next();
});
app.use(
  "/api/v1/auth",
  rateLimit(process.env.NODE_ENV === "test" ? 10000 : 60, 15 * 60 * 1000),
  require("./routes/auth"),
);
for (const route of [
  "reference",
  "items",
  "matches",
  "claims",
  "dashboard",
  "config",
])
  app.use("/api/v1/" + route, require("./routes/" + route));
app.use("/api/v1", require("./routes/health"));
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);
app.use(express.static(path.join(__dirname, "../client/dist")));
app.get("/{*path}", (req, res, next) => {
  if (!req.accepts("html")) return next();
  res.sendFile(path.join(__dirname, "../client/dist/index.html"), (e) => {
    if (e) next();
  });
});
app.use((req, res) => res.status(404).json({ error: "Page not found." }));
app.use(errorHandler);
module.exports = app;
