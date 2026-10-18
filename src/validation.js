function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function text(v, name, min = 1, max = 5000) {
  if (typeof v !== "string" || v.trim().length < min || v.length > max)
    fail(`${name} must contain ${min}–${max} characters.`);
  return v.trim();
}
function id(v, name = "ID") {
  if (
    !/^\d+$/.test(String(v)) ||
    !Number.isSafeInteger(Number(v)) ||
    Number(v) < 1
  )
    fail(`${name} must be a positive number.`);
  return Number(v);
}
function date(v) {
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    Number.isNaN(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    fail("Enter a valid date.");
  return v;
}
function item(body, kind) {
  const o = {
    item_name: text(body.item_name, "Item name", 1, 120),
    category_id: id(body.category_id, "Category"),
    location_id: id(body.location_id, "Location"),
    description: body.description
      ? text(body.description, "Description", 1, 3000)
      : null,
    brand_id: body.brand_id ? id(body.brand_id) : null,
    colour_id: body.colour_id ? id(body.colour_id) : null,
    brand_other: body.brand_other
      ? text(body.brand_other, "Other brand", 1, 80)
      : null,
  };
  o[kind + "_date"] = date(body[kind + "_date"]);
  if (o.brand_id && o.brand_other)
    fail("Choose a brand or enter another brand, not both.");
  if (kind === "found") {
    o.private_feature = text(
      body.private_feature,
      "Private identifying detail",
      1,
      3000,
    );
    o.custody = body.custody;
    if (
      ![
        "WITH_FINDER",
        "DEPOSITED_SECURITY",
        "DEPOSITED_DEPARTMENT",
        "DEPOSITED_HOSTEL",
      ].includes(o.custody)
    )
      fail("Choose who is holding this item.");
    o.storage_location = body.storage_location
      ? text(body.storage_location, "Storage location", 1, 160)
      : null;
    if (o.custody !== "WITH_FINDER" && !o.storage_location)
      fail("Enter where you deposited the item.");
    if (o.description?.toLowerCase().includes(o.private_feature.toLowerCase()))
      fail(
        "Keep the private identifying detail out of the public description.",
      );
    if (
      body.is_high_value !== undefined &&
      typeof body.is_high_value !== "boolean"
    )
      fail("High value must be true or false.");
    o.is_high_value = body.is_high_value === true;
  } else {
    for (const key of ["lost_time_from", "lost_time_to"]) {
      o[key] = body[key] || null;
      if (o[key] && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(o[key]))
        fail("Enter a valid time.");
    }
  }
  return o;
}
module.exports = { fail, text, id, date, item };
