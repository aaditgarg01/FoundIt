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
CREATE INDEX ix_users_role ON users(role) WHERE is_active = TRUE;
CREATE UNIQUE INDEX ux_users_email_lower ON users(lower(email));
CREATE INDEX ix_locations_zone ON locations(zone);

CREATE INDEX ix_found_match_probe ON found_items (category_id, found_date, status) WHERE status = 'AVAILABLE';
CREATE INDEX ix_lost_match_probe ON lost_items (category_id, lost_date, status) WHERE status = 'OPEN';
CREATE INDEX ix_found_browse ON found_items (status, found_date DESC, category_id, location_id);

CREATE INDEX ix_lost_user ON lost_items(user_id, created_at DESC);
CREATE INDEX ix_found_user ON found_items(user_id, created_at DESC);

CREATE INDEX ix_lost_location ON lost_items(location_id);
CREATE INDEX ix_found_location ON found_items(location_id);

CREATE INDEX ix_matches_lost ON matches(lost_id, match_score DESC);
CREATE INDEX ix_matches_found ON matches(found_id, match_score DESC);
CREATE INDEX ix_matches_band ON matches(match_band, status);

CREATE INDEX ix_claims_match ON claims(match_id, status);
CREATE INDEX ix_claims_claimant ON claims(claimant_id, status);
CREATE INDEX ix_claims_pending ON claims(claimed_at) WHERE status = 'PENDING';

CREATE UNIQUE INDEX ux_one_approved_claim_per_found ON claims(found_id) WHERE status IN ('APPROVED','COMPLETED');

CREATE INDEX ix_audit_entity ON audit_log(entity_type, entity_id, changed_at);

CREATE INDEX ix_lost_fts ON lost_items USING GIN(search_vector);
CREATE INDEX ix_found_fts ON found_items USING GIN(search_vector);
        `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`
DROP INDEX ix_found_fts;
DROP INDEX ix_lost_fts;
DROP INDEX ix_audit_entity;
DROP INDEX ux_one_approved_claim_per_found;
DROP INDEX ix_claims_pending;
DROP INDEX ix_claims_claimant;
DROP INDEX ix_claims_match;
DROP INDEX ix_matches_band;
DROP INDEX ix_matches_found;
DROP INDEX ix_matches_lost;
DROP INDEX ix_found_location;
DROP INDEX ix_lost_location;
DROP INDEX ix_found_user;
DROP INDEX ix_lost_user;
DROP INDEX ix_found_browse;
DROP INDEX ix_lost_match_probe;
DROP INDEX ix_found_match_probe;
DROP INDEX ix_locations_zone;
DROP INDEX ux_users_email_lower;
DROP INDEX ix_users_role;
        `);
};
