const fs = require('fs');
let content = fs.readFileSync('db/tests/negative_tests.sql', 'utf8');

// 1. Add v_lost_id_2
content = content.replace(
  "v_lost_id INTEGER;",
  "v_lost_id INTEGER;\n    v_lost_id_2 INTEGER;"
);
content = content.replace(
  "RETURNING lost_id INTO v_lost_id;",
  "RETURNING lost_id INTO v_lost_id;\n    INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date) VALUES (v_user_id, 'Valid Lost 2', v_cat_id, v_loc_id, 'Desc', '2026-01-01') RETURNING lost_id INTO v_lost_id_2;"
);

// 2. Fix uq_users_email block
// no change needed to uq_users_email test, just add ux_users_email_lower below it
const usersTestIdx = content.indexOf("-- CATEGORIES & LOCATIONS");
content = content.slice(0, usersTestIdx) + `    BEGIN
        INSERT INTO users (full_name, email, password_hash) VALUES ('Test 4', 'VALID@vit.ac.in', repeat('x',60));
        RAISE NOTICE 'FAIL: ux_users_email_lower did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ux_users_email_lower' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ux_users_email_lower, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    ` + content.slice(usersTestIdx);

// 3. Fix ck_claim_completion
content = content.replace(
  "INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status, completed_at)\n        VALUES (v_match_id, v_user_id, v_found_id, 'long enough proof here', 'COMPLETED', NULL);",
  "INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status, decided_at, verifier_id, completed_at)\n        VALUES (v_match_id, v_user_id, v_found_id, 'long enough proof here', 'COMPLETED', NOW(), v_user_id_2, NULL);"
);

// 4. Fix matches shadowed tests (v_lost_id -> v_lost_id_2) for ck_match_score_range and ck_match_band_consistent
content = content.replace(
  "INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status)\n        VALUES (v_lost_id, v_found_id, 150, 'STRONG', '{}', 'SUGGESTED');",
  "INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status)\n        VALUES (v_lost_id_2, v_found_id, 150, 'STRONG', '{}', 'SUGGESTED');"
);
content = content.replace(
  "INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status)\n        VALUES (v_lost_id, v_found_id, 50, 'STRONG', '{}', 'SUGGESTED');",
  "INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status)\n        VALUES (v_lost_id_2, v_found_id, 50, 'STRONG', '{}', 'SUGGESTED');"
);

// 5. Add fk_match_band
const matchesTestIdx = content.indexOf("-- LOST ITEMS");
content = content.slice(0, matchesTestIdx) + `    BEGIN
        INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status)
        VALUES (v_lost_id_2, v_found_id, 85, 'NON_EXISTENT_BAND', '{}', 'SUGGESTED');
        RAISE NOTICE 'FAIL: fk_match_band did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_match_band' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_match_band, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    ` + content.slice(matchesTestIdx);

// 6. Add ck_found_brand_exclusive
const foundItemsIdx = content.indexOf("-- CLAIMS");
content = content.slice(0, foundItemsIdx) + `    BEGIN
        INSERT INTO found_items (user_id, item_name, category_id, location_id, custody, found_date, brand_id, brand_other)
        VALUES (v_user_id, 'Found', v_cat_id, v_loc_id, 'WITH_FINDER', CURRENT_DATE, v_br_id, 'Other Brand');
        RAISE NOTICE 'FAIL: ck_found_brand_exclusive did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_found_brand_exclusive' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_found_brand_exclusive, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    ` + content.slice(foundItemsIdx);

// 7. Add ck_score_band_range
const scoreBandIdx = content.indexOf("EXCEPTION WHEN OTHERS THEN\n        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;");
// wait, I can just add it before the very first BEGIN block or after -- USERS
const startIdx = content.indexOf("---------------------------------------------------------------------------\n    -- USERS");
content = content.slice(0, startIdx) + `---------------------------------------------------------------------------
    -- SCORE BANDS
    ---------------------------------------------------------------------------
    BEGIN
        INSERT INTO score_bands (band_name, lower_bound, upper_bound)
        VALUES ('TEST_BAND', 100, 50);
        RAISE NOTICE 'FAIL: ck_score_band_range did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_score_band_range' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_score_band_range, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    ` + content.slice(startIdx);

fs.writeFileSync('db/tests/negative_tests.sql', content);
