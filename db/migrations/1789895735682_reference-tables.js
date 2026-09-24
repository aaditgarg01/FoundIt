/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.sql(`
CREATE TABLE locations (
    location_id          SERIAL PRIMARY KEY,
    location_name        VARCHAR(120)  NOT NULL,
    building             VARCHAR(80)   NOT NULL,
    floor                VARCHAR(20),
    zone                 VARCHAR(40),
    is_active            BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_locations_name_building UNIQUE (location_name, building)
);

CREATE TABLE categories (
    category_id          SERIAL PRIMARY KEY,
    category_name        VARCHAR(80)   NOT NULL,
    parent_id            INTEGER,
    requires_staff       BOOLEAN       NOT NULL DEFAULT FALSE,
    is_sensitive         BOOLEAN       NOT NULL DEFAULT FALSE,
    is_active            BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_categories_name UNIQUE (category_name),
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_categories_no_self_parent CHECK (parent_id IS NULL OR parent_id <> category_id)
);

CREATE TABLE colours (
    colour_id            SERIAL PRIMARY KEY,
    colour_name          VARCHAR(40)   NOT NULL,
    hex_value            CHAR(7),
    is_active            BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_colours_name UNIQUE (colour_name),
    CONSTRAINT ck_colours_hex CHECK (hex_value IS NULL OR hex_value ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE brands (
    brand_id             SERIAL PRIMARY KEY,
    brand_name           VARCHAR(80)   NOT NULL,
    is_active            BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_brands_name UNIQUE (brand_name)
);

CREATE TABLE score_bands (
    band_name            VARCHAR(20)   PRIMARY KEY,
    lower_bound          SMALLINT      NOT NULL,
    upper_bound          SMALLINT      NOT NULL,
    CONSTRAINT ck_score_band_range CHECK (lower_bound <= upper_bound)
);

CREATE TABLE match_config (
    config_key           VARCHAR(60)   PRIMARY KEY,
    config_value         INTEGER       NOT NULL,
    description          VARCHAR(200)  NOT NULL,
    version              INTEGER       NOT NULL DEFAULT 1,
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
        `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`
DROP TABLE match_config;
DROP TABLE score_bands;
DROP TABLE brands;
DROP TABLE colours;
DROP TABLE categories;
DROP TABLE locations;
        `);
};
