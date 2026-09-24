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
CREATE TABLE audit_log (
    audit_id             BIGSERIAL PRIMARY KEY,
    entity_type          audit_entity  NOT NULL,
    entity_id            INTEGER       NOT NULL,
    action               VARCHAR(40)   NOT NULL,
    old_status           VARCHAR(30),
    new_status           VARCHAR(30),
    changed_by           INTEGER,
    detail               JSONB,
    changed_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_audit_user FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT ck_audit_status_change CHECK (action <> 'STATUS_CHANGED' OR (old_status IS NOT NULL AND new_status IS NOT NULL)),
    CONSTRAINT ck_audit_status_differ CHECK (old_status IS NULL OR new_status IS NULL OR old_status <> new_status),
    CONSTRAINT ck_audit_action_known CHECK (action IN ('CREATED','UPDATED','STATUS_CHANGED','MATCHED','CLAIM_CREATED', 'CLAIM_APPROVED','CLAIM_REJECTED','CLAIM_WITHDRAWN','COMPLETED', 'REVERSED','EXPIRED','DELETED'))
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'foundit_app') THEN
    CREATE ROLE foundit_app NOLOGIN;
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO foundit_app;
GRANT DELETE ON sessions TO foundit_app;
REVOKE UPDATE, DELETE ON audit_log FROM foundit_app;
        `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`
DROP TABLE audit_log;
        `);
};
