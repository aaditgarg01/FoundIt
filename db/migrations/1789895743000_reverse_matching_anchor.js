// FR-3.6: score only the newly found anchor during reverse matching.
exports.up = (pgm) =>
  pgm.sql(`
CREATE FUNCTION generate_matches(p_lost_id INTEGER,p_found_id INTEGER) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE cfg JSONB; v_version INTEGER; v_count INTEGER;
BEGIN
 SELECT jsonb_object_agg(config_key,config_value),max(version) INTO cfg,v_version FROM match_config;
 WITH pairs AS (
 SELECT l.lost_id,f.found_id,l.category_id=f.category_id AS cat,
 l.brand_id=f.brand_id AS brand,l.location_id=f.location_id AS loc,l.colour_id=f.colour_id AS col,
 f.found_date-l.lost_date AS gap,
 cardinality(ARRAY(SELECT unnest(tsvector_to_array(l.search_vector)) INTERSECT SELECT unnest(tsvector_to_array(f.search_vector)))) AS words
 FROM lost_items l JOIN found_items f ON f.status='AVAILABLE'
 AND f.found_date BETWEEN l.lost_date AND l.lost_date+(cfg->>'DATE_WINDOW_DAYS')::int
 AND l.user_id IS DISTINCT FROM f.user_id
 AND (l.category_id=f.category_id OR (l.location_id=f.location_id AND l.colour_id=f.colour_id))
 WHERE (p_lost_id IS NULL OR l.lost_id=p_lost_id) AND (p_found_id IS NULL OR f.found_id=p_found_id) AND l.status='OPEN'
 ), components AS (
 SELECT *, CASE WHEN cat THEN (cfg->>'W_CATEGORY')::int ELSE 0 END AS pcat,
 CASE WHEN brand THEN (cfg->>'W_BRAND')::int ELSE 0 END AS pbrand,
 CASE WHEN loc THEN (cfg->>'W_LOCATION')::int ELSE 0 END AS ploc,
 CASE WHEN col THEN (cfg->>'W_COLOUR')::int ELSE 0 END AS pcol,
 round((cfg->>'W_DATE_MAX')::numeric * CASE WHEN gap=0 THEN 1 WHEN gap=1 THEN 13.0/15 WHEN gap=2 THEN 10.0/15 WHEN gap<=5 THEN 6.0/15 WHEN gap<=14 THEN 3.0/15 ELSE 0 END)::int AS pdate,
 least((cfg->>'W_DESC_MAX')::int, round(words*(cfg->>'W_DESC_MAX')::numeric/2)::int) AS pdesc FROM pairs
 ), scored AS (SELECT *,pcat+pbrand+ploc+pcol+pdate+pdesc AS score FROM components)
 INSERT INTO matches(lost_id,found_id,match_score,match_band,reason_json)
 SELECT s.lost_id,s.found_id,s.score,b.band_name,jsonb_build_object('total',s.score,'weights_version',v_version,'components',jsonb_build_array(
 jsonb_build_object('code','CATEGORY','label','Category','points',pcat),
 jsonb_build_object('code','BRAND','label','Brand','points',pbrand),
 jsonb_build_object('code','LOCATION','label','Location','points',ploc),
 jsonb_build_object('code','COLOUR','label','Colour','points',pcol),
 jsonb_build_object('code','DATE','label','Date proximity','points',pdate,'gap',gap),
 jsonb_build_object('code','DESC','label','Shared keywords','points',pdesc)))
 FROM scored s JOIN score_bands b ON s.score BETWEEN b.lower_bound AND b.upper_bound
 WHERE score >= (cfg->>'T_FLOOR')::int
 ON CONFLICT(lost_id,found_id) DO UPDATE SET match_score=EXCLUDED.match_score,match_band=EXCLUDED.match_band,reason_json=EXCLUDED.reason_json,updated_at=NOW()
 WHERE matches.status='SUGGESTED';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION generate_matches_for_lost(p_lost_id INTEGER) RETURNS INTEGER LANGUAGE sql AS $$ SELECT generate_matches(p_lost_id,NULL::integer) $$;
CREATE OR REPLACE FUNCTION generate_matches_for_found(p_found_id INTEGER) RETURNS INTEGER LANGUAGE sql AS $$ SELECT generate_matches(NULL::integer,p_found_id) $$;
`);
exports.down = () => {
  throw new Error("Forward-only migration");
};
