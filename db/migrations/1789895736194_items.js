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
CREATE TABLE lost_items (
    lost_id              SERIAL PRIMARY KEY,
    user_id              INTEGER       NOT NULL,
    item_name            VARCHAR(120)  NOT NULL,
    category_id          INTEGER       NOT NULL,
    location_id          INTEGER       NOT NULL,
    colour_id            INTEGER,
    brand_id             INTEGER,
    brand_other          VARCHAR(80),
    description          TEXT,
    lost_date            DATE          NOT NULL,
    lost_time_from       TIME,
    lost_time_to         TIME,
    status               lost_status   NOT NULL DEFAULT 'OPEN',
    resolved_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_lost_user     FOREIGN KEY (user_id)     REFERENCES users(user_id)         ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_lost_category FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_lost_location FOREIGN KEY (location_id) REFERENCES locations(location_id)  ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_lost_colour   FOREIGN KEY (colour_id)   REFERENCES colours(colour_id)      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_lost_brand    FOREIGN KEY (brand_id)    REFERENCES brands(brand_id)        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT ck_lost_time_order CHECK (lost_time_from IS NULL OR lost_time_to IS NULL OR lost_time_from <= lost_time_to),
    CONSTRAINT ck_lost_date_not_future CHECK (lost_date <= CURRENT_DATE),
    CONSTRAINT ck_lost_name_nonblank CHECK (length(trim(item_name)) > 0),
    CONSTRAINT ck_lost_brand_exclusive CHECK (
        (brand_id IS NULL AND brand_other IS NULL) OR
        (brand_id IS NOT NULL AND brand_other IS NULL) OR
        (brand_id IS NULL AND brand_other IS NOT NULL)
    ),
    CONSTRAINT ck_lost_resolved_consistent CHECK ((status = 'RESOLVED') = (resolved_at IS NOT NULL))
);

CREATE TABLE found_items (
    found_id             SERIAL PRIMARY KEY,
    user_id              INTEGER,
    finder_note          VARCHAR(160),
    item_name            VARCHAR(120)  NOT NULL,
    category_id          INTEGER       NOT NULL,
    location_id          INTEGER       NOT NULL,
    colour_id            INTEGER,
    brand_id             INTEGER,
    brand_other          VARCHAR(80),
    description          TEXT,
    private_feature      TEXT          NOT NULL,
    custody              custody_type  NOT NULL,
    is_high_value        BOOLEAN       NOT NULL DEFAULT FALSE,
    storage_location     VARCHAR(160),
    found_date           DATE          NOT NULL,
    found_time           TIME,
    status               found_status  NOT NULL DEFAULT 'AVAILABLE',
    returned_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_found_user     FOREIGN KEY (user_id)     REFERENCES users(user_id)         ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_found_category FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_found_location FOREIGN KEY (location_id) REFERENCES locations(location_id)  ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_found_colour   FOREIGN KEY (colour_id)   REFERENCES colours(colour_id)      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_found_brand    FOREIGN KEY (brand_id)    REFERENCES brands(brand_id)        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT ck_found_date_not_future CHECK (found_date <= CURRENT_DATE),
    CONSTRAINT ck_found_identity CHECK (user_id IS NOT NULL OR finder_note IS NOT NULL),
    CONSTRAINT ck_found_storage CHECK (custody = 'WITH_FINDER' OR storage_location IS NOT NULL),
    CONSTRAINT ck_found_private_nonblank CHECK (length(trim(private_feature)) > 0),
    CONSTRAINT ck_found_brand_exclusive CHECK (
        (brand_id IS NULL AND brand_other IS NULL) OR
        (brand_id IS NOT NULL AND brand_other IS NULL) OR
        (brand_id IS NULL AND brand_other IS NOT NULL)
    ),
    CONSTRAINT ck_found_returned_consistent CHECK ((status = 'RETURNED') = (returned_at IS NOT NULL))
);

ALTER TABLE lost_items ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(item_name,'') || ' ' || coalesce(description,''))
) STORED;

ALTER TABLE found_items ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(item_name,'') || ' ' || coalesce(description,''))
) STORED;
        `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`
DROP TABLE found_items;
DROP TABLE lost_items;
        `);
};
