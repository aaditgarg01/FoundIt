DO $$
DECLARE
    v_constraint TEXT;
    v_passed INTEGER := 0;
    v_failed INTEGER := 0;
    
    -- Variables to hold test data
    v_user_id INTEGER;
    v_cat_id INTEGER;
    v_loc_id INTEGER;
    v_col_id INTEGER;
    v_br_id INTEGER;
    v_lost_id INTEGER;
    v_found_id INTEGER;
    v_match_id INTEGER;
BEGIN
    RAISE NOTICE '--- RUNNING NEGATIVE TESTS ---';

    -- Setup minimal valid reference data
    INSERT INTO users (full_name, email, password_hash) VALUES ('Valid User', 'valid@vit.ac.in', repeat('x',60)) RETURNING user_id INTO v_user_id;
    INSERT INTO categories (category_name, requires_staff, is_sensitive) VALUES ('Valid Cat', false, false) RETURNING category_id INTO v_cat_id;
    INSERT INTO locations (location_name, building, zone) VALUES ('Valid Loc', 'Valid Bldg', 'Zone A') RETURNING location_id INTO v_loc_id;
    INSERT INTO colours (colour_name, hex_value) VALUES ('Valid Col', '#123456') RETURNING colour_id INTO v_col_id;
    INSERT INTO brands (brand_name) VALUES ('Valid Brand') RETURNING brand_id INTO v_br_id;
    
    INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date) 
    VALUES (v_user_id, 'Valid Lost', v_cat_id, v_loc_id, 'Desc', '2026-01-01') RETURNING lost_id INTO v_lost_id;
    
    INSERT INTO found_items (user_id, item_name, category_id, location_id, description, custody, found_date, private_feature) 
    VALUES (v_user_id, 'Valid Found', v_cat_id, v_loc_id, 'Desc', 'WITH_FINDER', '2026-01-02', 'Secret mark') RETURNING found_id INTO v_found_id;

    INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status)
    VALUES (v_lost_id, v_found_id, 85, 'STRONG', '{}', 'SUGGESTED') RETURNING match_id INTO v_match_id;

    ---------------------------------------------------------------------------
    -- USERS
    ---------------------------------------------------------------------------
    BEGIN
        INSERT INTO users (full_name, email, password_hash, flagged_count) VALUES ('Test', 'test@vit.ac.in', repeat('x',60), -1);
        RAISE NOTICE 'FAIL: ck_users_flagged_nonneg did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_users_flagged_nonneg' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_users_flagged_nonneg, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO users (full_name, email, password_hash) VALUES ('Test', 'invalidemail', repeat('x',60));
        RAISE NOTICE 'FAIL: ck_users_email_format did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_users_email_format' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_users_email_format, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO users (full_name, email, password_hash) VALUES ('   ', 'test2@vit.ac.in', repeat('x',60));
        RAISE NOTICE 'FAIL: ck_users_name_nonblank did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_users_name_nonblank' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_users_name_nonblank, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO users (full_name, email, password_hash) VALUES ('Test 3', 'valid@vit.ac.in', repeat('x',60));
        RAISE NOTICE 'FAIL: uq_users_email did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'uq_users_email' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected uq_users_email, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    ---------------------------------------------------------------------------
    -- CATEGORIES & LOCATIONS & COLOURS
    ---------------------------------------------------------------------------
    BEGIN
        INSERT INTO categories (category_id, category_name, requires_staff, is_sensitive, parent_id) 
        VALUES (999, 'Self Parent', false, false, 999);
        RAISE NOTICE 'FAIL: ck_categories_no_self_parent did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_categories_no_self_parent' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_categories_no_self_parent, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO colours (colour_name, hex_value) VALUES ('Invalid Hex', '123456');
        RAISE NOTICE 'FAIL: ck_colours_hex did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_colours_hex' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_colours_hex, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    ---------------------------------------------------------------------------
    -- LOST ITEMS
    ---------------------------------------------------------------------------
    BEGIN
        INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date) 
        VALUES (v_user_id, '  ', v_cat_id, v_loc_id, 'Desc', '2026-01-01');
        RAISE NOTICE 'FAIL: ck_lost_name_nonblank did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_lost_name_nonblank' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_lost_name_nonblank, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date) 
        VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', CURRENT_DATE + INTERVAL '1 day');
        RAISE NOTICE 'FAIL: ck_lost_date_not_future did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_lost_date_not_future' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_lost_date_not_future, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date, lost_time_from, lost_time_to) 
        VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', '2026-01-02', '10:00:00', '09:00:00');
        RAISE NOTICE 'FAIL: ck_lost_time_order did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_lost_time_order' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_lost_time_order, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date, brand_id, brand_other) 
        VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', '2026-01-01', v_br_id, 'Some Brand');
        RAISE NOTICE 'FAIL: ck_lost_brand_exclusive did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_lost_brand_exclusive' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_lost_brand_exclusive, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date, status, resolved_at) 
        VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', '2026-01-01', 'RESOLVED', NULL);
        RAISE NOTICE 'FAIL: ck_lost_resolved_consistent did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_lost_resolved_consistent' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_lost_resolved_consistent, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    ---------------------------------------------------------------------------
    -- FOUND ITEMS
    ---------------------------------------------------------------------------
    BEGIN
        INSERT INTO found_items (user_id, item_name, category_id, location_id, description, custody, found_date, private_feature) 
        VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', 'WITH_FINDER', CURRENT_DATE + INTERVAL '1 day', 'Secret mark');
        RAISE NOTICE 'FAIL: ck_found_date_not_future did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_found_date_not_future' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_found_date_not_future, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO found_items (user_id, item_name, category_id, location_id, description, custody, found_date, private_feature) 
        VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', 'WITH_FINDER', '2026-01-01', '   ');
        RAISE NOTICE 'FAIL: ck_found_private_nonblank did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_found_private_nonblank' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_found_private_nonblank, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO found_items (user_id, item_name, category_id, location_id, description, custody, found_date, private_feature) 
        VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', 'DEPOSITED_SECURITY', '2026-01-01', 'Secret mark');
        RAISE NOTICE 'FAIL: ck_found_storage did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_found_storage' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_found_storage, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO found_items (user_id, item_name, category_id, location_id, description, custody, found_date, status, returned_at, private_feature) 
        VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', 'WITH_FINDER', '2026-01-01', 'RETURNED', NULL, 'Secret mark');
        RAISE NOTICE 'FAIL: ck_found_returned_consistent did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_found_returned_consistent' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_found_returned_consistent, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    ---------------------------------------------------------------------------
    -- MATCHES
    ---------------------------------------------------------------------------
    BEGIN
        INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status)
        VALUES (v_lost_id, v_found_id, 150, 'STRONG', '{}', 'SUGGESTED');
        RAISE NOTICE 'FAIL: ck_match_score_range did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_match_score_range' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_match_score_range, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status)
        VALUES (v_lost_id, v_found_id, 50, 'STRONG', '{}', 'SUGGESTED');
        RAISE NOTICE 'FAIL: ck_match_band_consistent did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_match_band_consistent' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_match_band_consistent, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status)
        VALUES (v_lost_id, v_found_id, 85, 'STRONG', '{}', 'SUGGESTED');
        RAISE NOTICE 'FAIL: uq_match_pair did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'uq_match_pair' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected uq_match_pair, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    ---------------------------------------------------------------------------
    -- CLAIMS
    ---------------------------------------------------------------------------
    BEGIN
        INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status)
        VALUES (v_match_id, v_user_id, v_found_id, 'short', 'PENDING');
        RAISE NOTICE 'FAIL: ck_claim_proof_minlength did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_claim_proof_minlength' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_claim_proof_minlength, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status, verifier_id)
        VALUES (v_match_id, v_user_id, v_found_id, 'long enough proof here', 'PENDING', v_user_id);
        RAISE NOTICE 'FAIL: ck_claim_self_verify did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_claim_self_verify' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_claim_self_verify, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status, decided_at)
        VALUES (v_match_id, v_user_id, v_found_id, 'long enough proof here', 'PENDING', NOW());
        RAISE NOTICE 'FAIL: ck_claim_decision_consistent did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_claim_decision_consistent' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_claim_decision_consistent, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status, completed_at)
        VALUES (v_match_id, v_user_id, v_found_id, 'long enough proof here', 'COMPLETED', NULL);
        RAISE NOTICE 'FAIL: ck_claim_completion did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_claim_completion' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_claim_completion, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    ---------------------------------------------------------------------------
    -- AUDIT LOG
    ---------------------------------------------------------------------------
    BEGIN
        INSERT INTO audit_log (entity_type, entity_id, action) VALUES ('LOST_ITEM', v_lost_id, 'INVALID_ACTION');
        RAISE NOTICE 'FAIL: ck_audit_action_known did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_audit_action_known' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_audit_action_known, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO audit_log (entity_type, entity_id, action, old_status, new_status) VALUES ('LOST_ITEM', v_lost_id, 'STATUS_CHANGED', 'OPEN', 'OPEN');
        RAISE NOTICE 'FAIL: ck_audit_status_differ did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_audit_status_differ' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_audit_status_differ, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO audit_log (entity_type, entity_id, action, old_status, new_status) VALUES ('LOST_ITEM', v_lost_id, 'STATUS_CHANGED', NULL, 'OPEN');
        RAISE NOTICE 'FAIL: ck_audit_status_change did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_audit_status_change' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_audit_status_change, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;
    
    ---------------------------------------------------------------------------

    BEGIN
        INSERT INTO audit_log (entity_type, entity_id, action, changed_by) VALUES ('LOST_ITEM', v_lost_id, 'STATUS_CHANGED', 9999);
        RAISE NOTICE 'FAIL: fk_audit_user did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_audit_user' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_audit_user, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO brands (brand_name) VALUES ('Valid Brand');
        RAISE NOTICE 'FAIL: uq_brands_name did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'uq_brands_name' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected uq_brands_name, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO categories (category_name, parent_id) VALUES ('Child', 9999);
        RAISE NOTICE 'FAIL: fk_categories_parent did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_categories_parent' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_categories_parent, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO categories (category_name) VALUES ('Valid Cat');
        RAISE NOTICE 'FAIL: uq_categories_name did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'uq_categories_name' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected uq_categories_name, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status) VALUES (v_match_id, 9999, v_found_id, 'long enough', 'PENDING');
        RAISE NOTICE 'FAIL: fk_claim_claimant did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_claim_claimant' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_claim_claimant, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status) VALUES (v_match_id, v_user_id, 9999, 'long enough', 'PENDING');
        RAISE NOTICE 'FAIL: fk_claim_found did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_claim_found' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_claim_found, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status) VALUES (9999, v_user_id, v_found_id, 'long enough', 'PENDING');
        RAISE NOTICE 'FAIL: fk_claim_match did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_claim_match' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_claim_match, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status, verifier_id) VALUES (v_match_id, v_user_id, v_found_id, 'long enough', 'APPROVED', 9999);
        RAISE NOTICE 'FAIL: fk_claim_verifier did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_claim_verifier' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_claim_verifier, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO colours (colour_name, hex_value) VALUES ('Valid Col', '#654321');
        RAISE NOTICE 'FAIL: uq_colours_name did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'uq_colours_name' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected uq_colours_name, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO found_items (user_id, item_name, category_id, location_id, description, custody, found_date, private_feature, brand_id) VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', 'WITH_FINDER', CURRENT_DATE, 'Secret', 9999);
        RAISE NOTICE 'FAIL: fk_found_brand did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_found_brand' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_found_brand, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO found_items (user_id, item_name, category_id, location_id, description, custody, found_date, private_feature) VALUES (v_user_id, 'Item', 9999, v_loc_id, 'Desc', 'WITH_FINDER', CURRENT_DATE, 'Secret');
        RAISE NOTICE 'FAIL: fk_found_category did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_found_category' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_found_category, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO found_items (user_id, item_name, category_id, location_id, description, custody, found_date, private_feature, colour_id) VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', 'WITH_FINDER', CURRENT_DATE, 'Secret', 9999);
        RAISE NOTICE 'FAIL: fk_found_colour did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_found_colour' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_found_colour, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO found_items (user_id, item_name, category_id, location_id, description, custody, found_date, private_feature) VALUES (v_user_id, 'Item', v_cat_id, 9999, 'Desc', 'WITH_FINDER', CURRENT_DATE, 'Secret');
        RAISE NOTICE 'FAIL: fk_found_location did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_found_location' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_found_location, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO found_items (user_id, item_name, category_id, location_id, description, custody, found_date, private_feature) VALUES (9999, 'Item', v_cat_id, v_loc_id, 'Desc', 'WITH_FINDER', CURRENT_DATE, 'Secret');
        RAISE NOTICE 'FAIL: fk_found_user did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_found_user' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_found_user, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO locations (location_name, building, zone) VALUES ('Valid Loc', 'Valid Bldg', 'Zone B');
        RAISE NOTICE 'FAIL: uq_locations_name_building did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'uq_locations_name_building' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected uq_locations_name_building, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date, brand_id) VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', '2026-01-01', 9999);
        RAISE NOTICE 'FAIL: fk_lost_brand did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_lost_brand' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_lost_brand, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date) VALUES (v_user_id, 'Item', 9999, v_loc_id, 'Desc', '2026-01-01');
        RAISE NOTICE 'FAIL: fk_lost_category did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_lost_category' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_lost_category, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date, colour_id) VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', '2026-01-01', 9999);
        RAISE NOTICE 'FAIL: fk_lost_colour did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_lost_colour' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_lost_colour, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date) VALUES (v_user_id, 'Item', v_cat_id, 9999, 'Desc', '2026-01-01');
        RAISE NOTICE 'FAIL: fk_lost_location did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_lost_location' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_lost_location, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO lost_items (user_id, item_name, category_id, location_id, description, lost_date) VALUES (9999, 'Item', v_cat_id, v_loc_id, 'Desc', '2026-01-01');
        RAISE NOTICE 'FAIL: fk_lost_user did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_lost_user' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_lost_user, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status) VALUES (v_lost_id, v_found_id, 85, 'INVALID', '{}', 'SUGGESTED');
        RAISE NOTICE 'FAIL: fk_match_band did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_match_band' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_match_band, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status) VALUES (v_lost_id, 9999, 85, 'STRONG', '{}', 'SUGGESTED');
        RAISE NOTICE 'FAIL: fk_match_found did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_match_found' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_match_found, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO matches (lost_id, found_id, match_score, match_band, reason_json, status) VALUES (9999, v_found_id, 85, 'STRONG', '{}', 'SUGGESTED');
        RAISE NOTICE 'FAIL: fk_match_lost did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_match_lost' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_match_lost, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO sessions (session_id, user_id, expires_at) VALUES ('xyz', 9999, '2030-01-01');
        RAISE NOTICE 'FAIL: fk_session_user did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN foreign_key_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'fk_session_user' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected fk_session_user, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO found_items (user_id, item_name, category_id, location_id, description, custody, found_date, private_feature) VALUES (v_user_id, 'Item', v_cat_id, v_loc_id, 'Desc', 'WITH_FINDER', CURRENT_DATE, 'Secret'); INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status) VALUES (v_match_id, v_user_id, v_found_id, 'proof', 'PENDING');
        RAISE NOTICE 'FAIL: ck_found_identity did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ck_found_identity' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ck_found_identity, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status, verifier_id)
        VALUES (v_match_id, v_user_id, v_found_id, 'proof', 'APPROVED', v_user_id);
        
        INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status, verifier_id)
        VALUES (v_match_id, v_user_id, v_found_id, 'proof2', 'APPROVED', v_user_id);
        
        RAISE NOTICE 'FAIL: ux_one_approved_claim_per_found (APPROVED) did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ux_one_approved_claim_per_found' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ux_one_approved_claim_per_found, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    BEGIN
        INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status, completed_at, verifier_id)
        VALUES (v_match_id, v_user_id, v_found_id, 'proof', 'COMPLETED', NOW(), v_user_id);
        
        INSERT INTO claims (match_id, claimant_id, found_id, proof_text, status, completed_at, verifier_id)
        VALUES (v_match_id, v_user_id, v_found_id, 'proof2', 'COMPLETED', NOW(), v_user_id);
        
        RAISE NOTICE 'FAIL: ux_one_approved_claim_per_found (COMPLETED) did not fire'; v_failed := v_failed + 1;
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'ux_one_approved_claim_per_found' THEN v_passed := v_passed + 1; ELSE
            RAISE NOTICE 'FAIL: expected ux_one_approved_claim_per_found, got %', v_constraint; v_failed := v_failed + 1; END IF;
    END;

    ---------------------------------------------------------------------------
    -- SUMMARY
    ---------------------------------------------------------------------------
    RAISE NOTICE 'Passed: %', v_passed;
    RAISE NOTICE 'Failed: %', v_failed;

    IF v_failed > 0 THEN
        RAISE EXCEPTION 'TEST SUITE FAILED';
    END IF;
    
    -- Cleanup (rolling back automatically)
    RAISE EXCEPTION 'TEST SUITE PASSED - ROLLING BACK';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST SUITE PASSED - ROLLING BACK' THEN
        RAISE NOTICE '%', SQLERRM;
    ELSE
        RAISE;
    END IF;
END $$;
