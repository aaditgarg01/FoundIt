-- Up Migration

-- ix_found_match_probe
-- Used by generate_matches_for_lost to quickly find potential matches based on category, location, colour, brand
CREATE INDEX ix_found_match_probe ON found_items (category_id, status, found_date, location_id);

-- ix_lost_match_probe
-- Used by generate_matches_for_found to quickly find potential matches
CREATE INDEX ix_lost_match_probe ON lost_items (category_id, status, lost_date, location_id);

-- Down Migration

DROP INDEX ix_found_match_probe;
DROP INDEX ix_lost_match_probe;
