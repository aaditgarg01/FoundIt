const { randomUUID } = require("node:crypto");
function loggerMiddleware(req, res, next) {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);
  const start = Date.now();
  const routePath = req.path;
  res.on("finish", () => {
    if (process.env.NODE_ENV !== "test")
      console.log(
        JSON.stringify({
          request_id: req.id,
          method: req.method,
          path: routePath,
          status: res.statusCode,
          duration_ms: Date.now() - start,
        }),
      );
  });
  next();
}
function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ error: "Please send a valid JSON request." });
  const domain = {
    CLAIM_NOT_FOUND: [404, "Claim not found."],
    ITEM_NOT_AVAILABLE: [
      409,
      "This item has already been claimed by another verified owner.",
    ],
    CLAIM_NOT_PENDING: [409, "This claim is no longer pending."],
    MATCH_NOT_AVAILABLE: [409, "This match is no longer available."],
    MAX_PENDING_CLAIMS: [
      409,
      "You can have up to three pending claims. Wait for a decision before trying again.",
    ],
    MAX_ITEM_ATTEMPTS: [
      409,
      "This item needs staff assistance after three rejected claims.",
    ],
  };
  if (domain[err.message])
    return res
      .status(domain[err.message][0])
      .json({ error: domain[err.message][1] });
  if (err.status && err.status < 500)
    return res.status(err.status).json({ error: err.message });
  const codes = {
    23505: [409, "This record already exists or a claim is already pending."],
    23503: [400, "Please choose a valid category, location, brand and colour."],
    23514: [
      400,
      "These details do not meet the requirements. Check dates, proof and storage details.",
    ],
    23502: [400, "Please fill in all required fields."],
    "22P02": [400, "One of the values is invalid."],
    22007: [400, "Please enter a valid date."],
    22008: [400, "Please enter a valid date."],
    22001: [400, "One of the fields is too long."],
  };
  if (codes[err.code])
    return res.status(codes[err.code][0]).json({ error: codes[err.code][1] });
  // Never serialize database errors: detail/query can contain proof, passwords or private features.
  console.error(
    JSON.stringify({ request_id: req.id, code: err.code || "INTERNAL_ERROR" }),
  );
  res.status(500).json({
    error: "Something went wrong. Please try again.",
    request_id: req.id,
  });
}
function rateLimit(max, windowMs) {
  const hits = new Map();
  let count = 0;
  return (req, res, next) => {
    const now = Date.now();
    if (++count % 100 === 0)
      for (const [key, v] of hits) if (v.until < now) hits.delete(key);
    const key = req.ip;
    let hit = hits.get(key);
    if (!hit || hit.until < now) {
      hit = { n: 0, until: now + windowMs };
      hits.set(key, hit);
    }
    if (++hit.n > max) {
      res.setHeader("Retry-After", Math.ceil((hit.until - now) / 1000));
      return res.status(429).json({
        error: "Too many attempts. Please wait a few minutes and try again.",
      });
    }
    next();
  };
}
module.exports = { loggerMiddleware, errorHandler, rateLimit };
