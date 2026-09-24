exports.up = (pgm) => {
  pgm.sql(`
CREATE OR REPLACE FUNCTION generate_matches_for_lost(p_lost_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_floor    INTEGER;
    v_window   INTEGER;
    v_version  INTEGER;
    v_count    INTEGER;
BEGIN
    SELECT config_value INTO v_floor
        FROM match_config WHERE config_key = 'T_FLOOR';
    SELECT config_value INTO v_window
        FROM match_config WHERE config_key = 'DATE_WINDOW_DAYS';
    SELECT max(version) INTO v_version FROM match_config;

    WITH scored AS (
        SELECT
            l.lost_id,
            f.found_id,
            (  CASE WHEN l.category_id = f.category_id THEN 20 ELSE 0 END
             + CASE WHEN l.brand_id IS NOT NULL AND f.brand_id IS NOT NULL
                         AND l.brand_id = f.brand_id THEN 20 ELSE 0 END
             + CASE WHEN l.location_id = f.location_id THEN 20 ELSE 0 END
             + CASE WHEN l.colour_id IS NOT NULL AND f.colour_id IS NOT NULL
                         AND l.colour_id = f.colour_id THEN 15 ELSE 0 END
             + CASE
                 WHEN f.found_date <  l.lost_date THEN 0
                 WHEN f.found_date =  l.lost_date THEN 15
                 WHEN f.found_date -  l.lost_date = 1 THEN 13
                 WHEN f.found_date -  l.lost_date = 2 THEN 10
                 WHEN f.found_date -  l.lost_date BETWEEN 3 AND 5 THEN 6
                 WHEN f.found_date -  l.lost_date BETWEEN 6 AND 14 THEN 3
                 ELSE 0 END
             + LEAST(10, 5 * cardinality(ARRAY(
                   -- search_vector contains both item_name and description tokens.
                   SELECT unnest(tsvector_to_array(l.search_vector))
                   INTERSECT
                   SELECT unnest(tsvector_to_array(f.search_vector))
               )))
            ) AS score,
            l.category_id = f.category_id          AS m_cat,
            l.brand_id    = f.brand_id             AS m_brand,
            l.location_id = f.location_id          AS m_loc,
            l.colour_id   = f.colour_id            AS m_col,
            (f.found_date - l.lost_date)           AS day_gap,
            LEAST(10, 5 * cardinality(ARRAY(
                   SELECT unnest(tsvector_to_array(l.search_vector))
                   INTERSECT
                   SELECT unnest(tsvector_to_array(f.search_vector))
               ))) AS m_desc_score
        FROM lost_items  l
        JOIN found_items f
          ON  f.status = 'AVAILABLE'
          AND f.found_date BETWEEN l.lost_date
                               AND l.lost_date + v_window
          AND l.user_id IS DISTINCT FROM f.user_id
          AND ( l.category_id = f.category_id
                OR ( l.location_id = f.location_id
                     AND l.colour_id IS NOT NULL
                     AND l.colour_id = f.colour_id ) )
        WHERE l.lost_id = p_lost_id
          AND l.status  = 'OPEN'
    )
    INSERT INTO matches (lost_id, found_id, match_score, match_band,
                         reason_json, status)
    SELECT
        s.lost_id,
        s.found_id,
        LEAST(s.score, 100),
        b.band_name,
        jsonb_build_object(
            'total', LEAST(s.score, 100),
            'weights_version', v_version,
            'components', jsonb_build_array(
                jsonb_build_object('code','CATEGORY','points',
                    CASE WHEN s.m_cat THEN 20 ELSE 0 END),
                jsonb_build_object('code','BRAND','points',
                    CASE WHEN s.m_brand THEN 20 ELSE 0 END),
                jsonb_build_object('code','LOCATION','points',
                    CASE WHEN s.m_loc THEN 20 ELSE 0 END),
                jsonb_build_object('code','COLOUR','points',
                    CASE WHEN s.m_col THEN 15 ELSE 0 END),
                jsonb_build_object('code','DATE','points',
                    CASE WHEN s.day_gap = 0 THEN 15
                         WHEN s.day_gap = 1 THEN 13
                         WHEN s.day_gap = 2 THEN 10
                         WHEN s.day_gap BETWEEN 3 AND 5 THEN 6
                         WHEN s.day_gap BETWEEN 6 AND 14 THEN 3
                         ELSE 0 END,
                    'gap', s.day_gap),
                jsonb_build_object('code','DESC','points', s.m_desc_score)
            )
        ),
        'SUGGESTED'
    FROM scored s
    JOIN score_bands b
      ON LEAST(s.score,100) BETWEEN b.lower_bound AND b.upper_bound
    WHERE s.score >= v_floor
    ON CONFLICT (lost_id, found_id) DO UPDATE
        SET match_score = EXCLUDED.match_score,
            match_band  = EXCLUDED.match_band,
            reason_json = EXCLUDED.reason_json,
            updated_at  = NOW()
        WHERE matches.status = 'SUGGESTED';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP FUNCTION IF EXISTS generate_matches_for_lost(INTEGER)`);
};
