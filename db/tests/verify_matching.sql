BEGIN;

-- Get required configs
DO $$
DECLARE
    v_cat1 INT;
    v_cat2 INT;
    v_loc1 INT;
    v_loc2 INT;
    v_user1 INT;
    v_user2 INT;
    v_br1 INT;
    v_col1 INT;
BEGIN
    SELECT category_id INTO v_cat1 FROM categories LIMIT 1;
    SELECT category_id INTO v_cat2 FROM categories WHERE category_id <> v_cat1 LIMIT 1;
    SELECT location_id INTO v_loc1 FROM locations LIMIT 1;
    SELECT location_id INTO v_loc2 FROM locations WHERE location_id <> v_loc1 LIMIT 1;
    SELECT user_id INTO v_user1 FROM users LIMIT 1;
    SELECT user_id INTO v_user2 FROM users WHERE user_id <> v_user1 LIMIT 1;
    SELECT brand_id INTO v_br1 FROM brands LIMIT 1;
    SELECT colour_id INTO v_col1 FROM colours LIMIT 1;

    -- Pair 1: Perfect match (Score: Cat=20, Brand=20, Loc=20, Col=15, Time=15 (0 gap), Desc=10 = 100)
    INSERT INTO lost_items (lost_id, user_id, category_id, brand_id, colour_id, location_id, lost_date, item_name, description) VALUES (9001, v_user1, v_cat1, v_br1, v_col1, v_loc1, '2026-05-01', 'xyz123', 'unique_term1 unique_term2');
    INSERT INTO found_items (found_id, user_id, category_id, brand_id, colour_id, location_id, found_date, item_name, description) VALUES (9001, v_user2, v_cat1, v_br1, v_col1, v_loc1, '2026-05-01', 'xyz123', 'unique_term1 unique_term2');

    -- Pair 2: Time gap 1 (Time=13), Score=98
    INSERT INTO lost_items (lost_id, user_id, category_id, brand_id, colour_id, location_id, lost_date, item_name, description) VALUES (9002, v_user1, v_cat1, v_br1, v_col1, v_loc1, '2026-05-01', 'xyz123', 'unique_term1 unique_term2');
    INSERT INTO found_items (found_id, user_id, category_id, brand_id, colour_id, location_id, found_date, item_name, description) VALUES (9002, v_user2, v_cat1, v_br1, v_col1, v_loc1, '2026-05-02', 'xyz123', 'unique_term1 unique_term2');

    -- Pair 3: Time gap 2 (Time=10), Score=95
    INSERT INTO lost_items (lost_id, user_id, category_id, brand_id, colour_id, location_id, lost_date, item_name, description) VALUES (9003, v_user1, v_cat1, v_br1, v_col1, v_loc1, '2026-05-01', 'xyz123', 'unique_term1 unique_term2');
    INSERT INTO found_items (found_id, user_id, category_id, brand_id, colour_id, location_id, found_date, item_name, description) VALUES (9003, v_user2, v_cat1, v_br1, v_col1, v_loc1, '2026-05-03', 'xyz123', 'unique_term1 unique_term2');

    -- Pair 4: found before lost (Time=0), Score=85
    INSERT INTO lost_items (lost_id, user_id, category_id, brand_id, colour_id, location_id, lost_date, item_name, description) VALUES (9004, v_user1, v_cat1, v_br1, v_col1, v_loc1, '2026-05-02', 'xyz123', 'unique_term1 unique_term2');
    INSERT INTO found_items (found_id, user_id, category_id, brand_id, colour_id, location_id, found_date, item_name, description) VALUES (9004, v_user2, v_cat1, v_br1, v_col1, v_loc1, '2026-05-01', 'xyz123', 'unique_term1 unique_term2');

    -- Pair 5: All optional nulls (Score: Cat=20, Brand=0, Loc=20, Col=0, Time=15, Desc=10 = 65)
    INSERT INTO lost_items (lost_id, user_id, category_id, brand_id, colour_id, location_id, lost_date, item_name, description) VALUES (9005, v_user1, v_cat1, NULL, NULL, v_loc1, '2026-05-01', 'xyz123', 'unique_term1 unique_term2');
    INSERT INTO found_items (found_id, user_id, category_id, brand_id, colour_id, location_id, found_date, item_name, description) VALUES (9005, v_user2, v_cat1, NULL, NULL, v_loc1, '2026-05-01', 'xyz123', 'unique_term1 unique_term2');

    -- Wait, if I do all this in JS it might be easier to assert!
END;
$$;
ROLLBACK;
