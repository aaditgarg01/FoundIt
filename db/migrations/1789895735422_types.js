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
CREATE TYPE user_role AS ENUM ('STUDENT', 'STAFF', 'ADMIN');
CREATE TYPE lost_status AS ENUM ('OPEN', 'MATCHED', 'RESOLVED', 'CLOSED_BY_USER', 'EXPIRED');
CREATE TYPE found_status AS ENUM ('AVAILABLE', 'CLAIMED', 'RETURNED', 'DISPOSED');
CREATE TYPE match_status AS ENUM ('SUGGESTED', 'CLAIMED', 'CONFIRMED', 'REJECTED_BY_USER', 'INVALIDATED');
CREATE TYPE claim_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'COMPLETED', 'REVERSED');
CREATE TYPE custody_type AS ENUM ('WITH_FINDER', 'DEPOSITED_SECURITY', 'DEPOSITED_DEPARTMENT', 'DEPOSITED_HOSTEL');
CREATE TYPE audit_entity AS ENUM ('LOST_ITEM', 'FOUND_ITEM', 'MATCH', 'CLAIM', 'USER');
        `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`
DROP TYPE audit_entity;
DROP TYPE custody_type;
DROP TYPE claim_status;
DROP TYPE match_status;
DROP TYPE found_status;
DROP TYPE lost_status;
DROP TYPE user_role;
        `);
};
