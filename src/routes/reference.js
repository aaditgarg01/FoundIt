const r = require("express").Router(),
  C = require("../controllers/reference"),
  { requireAuth, requireRole } = require("../middlewares/auth"),
  Q = require("../../db/queries/reference"),
  { pool, withTransaction } = require("../db"),
  V = require("../validation");
r.get("/", C.getAll);
r.post("/invalidate", requireAuth, requireRole(["ADMIN"]), C.invalidate);
async function write(req, res, next) {
  try {
    const kind = req.params.kind,
      t = Q.tables[kind];
    if (!t) V.fail("Reference table not found.", 404);
    const data = {};
    for (const key of t.fields) {
      if (req.body[key] === undefined) continue;
      data[key] = ["requires_staff", "is_sensitive", "is_active"].includes(key)
        ? req.body[key] === true || req.body[key] === "true"
        : V.text(
            req.body[key],
            key,
            1,
            key === "hex_value"
              ? 7
              : key === "location_name"
                ? 120
                : key === "floor"
                  ? 20
                  : key === "zone" || key === "colour_name"
                    ? 40
                    : 80,
          );
    }
    if (!Object.keys(data).length) V.fail("Provide a field to update.");
    if (!req.params.id && !data[t.name]) V.fail("A name is required.");
    if (kind === "locations" && !req.params.id && !data.building)
      V.fail("A building is required.");
    if (
      kind === "colours" &&
      data.hex_value &&
      !/^#[0-9a-f]{6}$/i.test(data.hex_value)
    )
      V.fail("Choose a valid colour.");
    const result = await withTransaction(
      (c) =>
        c.query(
          Q.write(kind, data, req.params.id ? V.id(req.params.id) : null),
        ),
      req.user.userId,
    );
    if (!result.rowCount) V.fail("Reference value not found.", 404);
    res.status(req.params.id ? 200 : 201).json(result.rows[0]);
  } catch (e) {
    next(e);
  }
}
r.post("/:kind", requireAuth, requireRole(["ADMIN"]), write);
r.patch("/:kind/:id", requireAuth, requireRole(["ADMIN"]), write);
module.exports = r;
