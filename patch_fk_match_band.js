const fs = require('fs');
let content = fs.readFileSync('db/tests/negative_tests.sql', 'utf8');

// Fix ck_lost_brand_exclusive
content = content.replace(
  "INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date, brand_id, brand_other, private_feature) \n        VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', '2026-01-01', v_br_id, 'Some Brand');",
  "INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date, brand_id, brand_other) \n        VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', '2026-01-01', v_br_id, 'Some Brand');"
);

// Fix fk_match_band
const fk_match_band_orig = `    BEGIN
        INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status)
        VALUES (v_lost_id_2, v_found_id, 85, 'NON_EXISTENT_BAND', '{}', 'SUGGESTED');
        RAISE NOTICE 'FAIL: fk_match_band did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_match_band' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_match_band, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;`;

const fk_match_band_new = `    BEGIN
        DELETE FROM score_bands WHERE band_name = 'WEAK';
        INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status)
        VALUES (v_lost_id_2, v_found_id, 10, 'WEAK', '{}', 'SUGGESTED');
        RAISE NOTICE 'FAIL: fk_match_band did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_match_band' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_match_band, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;`;

content = content.replace(fk_match_band_orig, fk_match_band_new);

fs.writeFileSync('db/tests/negative_tests.sql', content);
