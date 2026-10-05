/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.sql(`
-- Audit Immutability Trigger
CREATE OR REPLACE FUNCTION trg_audit_immutable_fn() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log is append-only' USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION trg_audit_immutable_fn();

-- Claims Denormalisation Trigger (Alphabetically ordered before trg_no_self_claim)
CREATE OR REPLACE FUNCTION trg_claims_denormalise_found_fn() RETURNS TRIGGER AS $$
BEGIN
    SELECT found_id INTO NEW.found_id FROM matches WHERE match_id = NEW.match_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claims_denormalise_found
BEFORE INSERT ON claims
FOR EACH ROW EXECUTE FUNCTION trg_claims_denormalise_found_fn();

-- Prevent Self Claim Trigger (Requires NEW.found_id)
CREATE OR REPLACE FUNCTION trg_no_self_claim_fn() RETURNS TRIGGER AS $$
DECLARE
    v_finder_id INTEGER;
BEGIN
    SELECT user_id INTO v_finder_id FROM found_items WHERE found_id = NEW.found_id;
    IF NEW.claimant_id = v_finder_id THEN
        RAISE EXCEPTION 'Finder cannot claim their own found item' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_no_self_claim
BEFORE INSERT ON claims
FOR EACH ROW EXECUTE FUNCTION trg_no_self_claim_fn();

-- The Approval Transaction stored procedure
CREATE OR REPLACE PROCEDURE approve_claim(p_claim_id INTEGER, p_verifier_id INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
    v_found_id INTEGER;
    v_lost_id INTEGER;
    v_status claim_status;
    v_found_status found_status;
BEGIN
  -- Step 1. Acquire the lock. This is the entire defence.
  SELECT f.found_id, f.status
    INTO v_found_id, v_found_status
    FROM found_items f
   WHERE f.found_id = (SELECT found_id FROM claims WHERE claim_id = p_claim_id)
     FOR UPDATE;

  -- Step 2. Re-verify under the lock. The value read here is authoritative.
  IF v_found_status <> 'AVAILABLE' THEN
      RAISE EXCEPTION 'ITEM_NOT_AVAILABLE'
          USING ERRCODE = 'P0001';
  END IF;

  -- Step 3. Verify the claim is still pending.
  SELECT status INTO v_status
    FROM claims WHERE claim_id = p_claim_id FOR UPDATE;
  IF v_status <> 'PENDING' THEN
      RAISE EXCEPTION 'CLAIM_NOT_PENDING' USING ERRCODE = 'P0001';
  END IF;

  -- Step 4. Approve this claim.
  UPDATE claims
     SET status = 'APPROVED', verifier_id = p_verifier_id, decided_at = NOW()
   WHERE claim_id = p_claim_id;

  -- Step 5. Move the found item out of circulation.
  UPDATE found_items SET status = 'CLAIMED', updated_at = NOW()
   WHERE found_id = v_found_id;

  -- Step 6. Move the linked lost item.
  SELECT lost_id INTO v_lost_id FROM matches
   WHERE match_id = (SELECT match_id FROM claims WHERE claim_id = p_claim_id);
   
  UPDATE lost_items SET status = 'MATCHED', updated_at = NOW()
   WHERE lost_id = v_lost_id;

  -- Step 7. Reject every competing pending claim on the same found item.
  UPDATE claims
     SET status = 'REJECTED', decided_at = NOW(),
         decision_note = 'Item claimed by another verified owner'
   WHERE found_id = v_found_id
     AND status = 'PENDING'
     AND claim_id <> p_claim_id;

  -- Step 8. Confirm this match, invalidate the others on the same found item.
  UPDATE matches SET status = 'CONFIRMED'
   WHERE match_id = (SELECT match_id FROM claims WHERE claim_id = p_claim_id);
  UPDATE matches SET status = 'INVALIDATED'
   WHERE found_id = v_found_id AND status = 'SUGGESTED';

  -- Step 9. Audit every change, inside the same transaction.
  INSERT INTO audit_log (entity_type, entity_id, action, old_status,
                         new_status, changed_by, detail)
  VALUES ('CLAIM', p_claim_id, 'CLAIM_APPROVED', 'PENDING', 'APPROVED',
          p_verifier_id, '{"note": "Proof accepted by verifier"}'),
         ('FOUND_ITEM', v_found_id, 'STATUS_CHANGED', 'AVAILABLE', 'CLAIMED',
          p_verifier_id, NULL),
         ('LOST_ITEM', v_lost_id, 'STATUS_CHANGED', 'OPEN', 'MATCHED',
          p_verifier_id, NULL);

END;
$$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
DROP PROCEDURE approve_claim;
DROP TRIGGER trg_no_self_claim ON claims;
DROP FUNCTION trg_no_self_claim_fn;
DROP TRIGGER trg_claims_denormalise_found ON claims;
DROP FUNCTION trg_claims_denormalise_found_fn;
DROP TRIGGER trg_audit_immutable ON audit_log;
DROP FUNCTION trg_audit_immutable_fn;
  `);
};
