const tables = {
  categories: {
    id: "category_id",
    name: "category_name",
    fields: ["category_name", "requires_staff", "is_sensitive", "is_active"],
  },
  locations: {
    id: "location_id",
    name: "location_name",
    fields: ["location_name", "building", "floor", "zone", "is_active"],
  },
  brands: {
    id: "brand_id",
    name: "brand_name",
    fields: ["brand_name", "is_active"],
  },
  colours: {
    id: "colour_id",
    name: "colour_name",
    fields: ["colour_name", "hex_value", "is_active"],
  },
};
module.exports = {
  tables,
  all: (kind) => `SELECT * FROM ${kind} ORDER BY ${tables[kind].name}`,
  write(kind, data, id) {
    const keys = Object.keys(data);
    return {
      text: id
        ? `UPDATE ${kind} SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(",")} WHERE ${tables[kind].id}=$${keys.length + 1} RETURNING *`
        : `INSERT INTO ${kind}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
      values: id ? [...Object.values(data), id] : Object.values(data),
    };
  },
};
