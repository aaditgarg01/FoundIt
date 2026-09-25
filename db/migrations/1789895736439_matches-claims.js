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
CREATE TABLE matches (
    match_id             SERIAL PRIMARY KEY,
    lost_id              INTEGER       NOT NULL,
    found_id             INTEGER       NOT NULL,
    match_score          SMALLINT      NOT NULL,
    match_band           VARCHAR(20)   NOT NULL,
    reason_json          JSONB         NOT NULL,
    status               match_status  NOT NULL DEFAULT 'SUGGESTED',
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_match_lost FOREIGN KEY (lost_id) REFERENCES lost_items(lost_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_match_found FOREIGN KEY (found_id) REFERENCES found_items(found_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_match_band FOREIGN KEY (match_band) REFERENCES score_bands(band_name) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uq_match_pair UNIQUE (lost_id, found_id),
    CONSTRAINT ck_match_score_range CHECK (match_score BETWEEN 0 AND 100),
    CONSTRAINT ck_match_band_consistent CHECK (
        (match_score >= 80 AND match_band = 'STRONG') OR
        (match_score >= 60 AND match_score < 80 AND match_band = 'POSSIBLE') OR
        (match_score < 60 AND match_band = 'WEAK')
    )
);

CREATE TABLE claims (
    claim_id             SERIAL PRIMARY KEY,
    match_id             INTEGER       NOT NULL,
    claimant_id          INTEGER       NOT NULL,
    proof_text           TEXT          NOT NULL,
    status               claim_status  NOT NULL DEFAULT 'PENDING',
    verifier_id          INTEGER,
    decision_note        VARCHAR(300),
    claimed_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    decided_at           TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    CONSTRAINT fk_claim_match FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_claim_claimant FOREIGN KEY (claimant_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_claim_verifier FOREIGN KEY (verifier_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_claim_decision_consistent CHECK ((status IN ('PENDING','WITHDRAWN')) = (decided_at IS NULL)),
    CONSTRAINT ck_claim_completion CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL)),
    CONSTRAINT ck_claim_self_verify CHECK (verifier_id IS NULL OR verifier_id <> claimant_id),
    CONSTRAINT ck_claim_proof_minlength CHECK (length(trim(proof_text)) >= 10)
);

-- Note: The found_id column is NOT NULL and is populated by trg_claims_denormalise_found.
-- The trigger does not exist until migration 010. This is safe only because the table is empty at migration time.
ALTER TABLE claims ADD COLUMN found_id INTEGER NOT NULL;
ALTER TABLE claims ADD CONSTRAINT fk_claim_found FOREIGN KEY (found_id) REFERENCES found_items(found_id) ON DELETE RESTRICT ON UPDATE CASCADE;
        `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.sql(`
ALTER TABLE claims DROP CONSTRAINT fk_claim_found;
ALTER TABLE claims DROP COLUMN found_id;
DROP TABLE claims;
DROP TABLE matches;
        `);
};
