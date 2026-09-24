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
CREATE TABLE users (
    user_id              SERIAL PRIMARY KEY,
    full_name            VARCHAR(120)  NOT NULL,
    email                VARCHAR(160)  NOT NULL,
    password_hash        CHAR(60)      NOT NULL,
    phone                VARCHAR(20),
    department           VARCHAR(100),
    role                 user_role     NOT NULL DEFAULT 'STUDENT',
    is_active            BOOLEAN       NOT NULL DEFAULT TRUE,
    flagged_count        SMALLINT      NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
    CONSTRAINT ck_users_name_nonblank CHECK (length(trim(full_name)) > 0),
    CONSTRAINT ck_users_flagged_nonneg CHECK (flagged_count >= 0)
);

CREATE TABLE sessions (
    session_id           VARCHAR(64)   PRIMARY KEY,
    user_id              INTEGER       NOT NULL,
    expires_at           TIMESTAMPTZ   NOT NULL,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
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
DROP TABLE sessions;
DROP TABLE users;
        `);
};
