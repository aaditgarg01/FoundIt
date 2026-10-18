// FR-2.10, FR-6: close report-withdrawal / claim-creation race at the database.
exports.up = (pgm) =>
  pgm.sql(`
CREATE OR REPLACE FUNCTION guard_claim_fn() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_status found_status; v_limit INTEGER;
BEGIN
 SELECT status INTO v_status FROM found_items WHERE found_id=NEW.found_id FOR UPDATE;
 PERFORM pg_advisory_xact_lock(20401,NEW.claimant_id);
 IF v_status IS DISTINCT FROM 'AVAILABLE' THEN RAISE EXCEPTION 'ITEM_NOT_AVAILABLE'; END IF;
 PERFORM 1 FROM lost_items l JOIN matches m USING(lost_id)
 WHERE m.match_id=NEW.match_id AND l.user_id=NEW.claimant_id AND l.status='OPEN' AND m.status='SUGGESTED' FOR UPDATE OF l;
 IF NOT FOUND THEN RAISE EXCEPTION 'MATCH_NOT_AVAILABLE'; END IF;
 SELECT config_value INTO v_limit FROM match_config WHERE config_key='MAX_PENDING_CLAIMS';
 IF (SELECT count(*) FROM claims WHERE claimant_id=NEW.claimant_id AND status='PENDING') >= v_limit THEN RAISE EXCEPTION 'MAX_PENDING_CLAIMS'; END IF;
 IF (SELECT count(*) FROM claims WHERE claimant_id=NEW.claimant_id AND found_id=NEW.found_id AND status='REJECTED' AND decision_note IS DISTINCT FROM 'Item claimed by another verified owner')>=3 THEN RAISE EXCEPTION 'MAX_ITEM_ATTEMPTS'; END IF;
 RETURN NEW;
END $$;
-- Coarse location cannot be reconstructed from the reference location identifier.
CREATE OR REPLACE VIEW v_public_found_items AS
 SELECT f.found_id,CASE WHEN c.is_sensitive THEN c.category_name ELSE f.item_name END AS item_name,
 CASE WHEN c.is_sensitive THEN NULL ELSE f.description END AS description,
 f.category_id,CASE WHEN c.is_sensitive THEN NULL::integer ELSE f.location_id END AS location_id,
 f.brand_id,f.colour_id,f.found_date,f.custody,f.status,f.created_at,c.category_name,l.building,
 CASE WHEN c.is_sensitive THEN l.building ELSE l.location_name END AS location_name,b.brand_name,co.colour_name,co.hex_value,
 CASE WHEN c.is_sensitive THEN to_tsvector('english',c.category_name) ELSE f.search_vector END AS search_vector
 FROM found_items f JOIN categories c USING(category_id) JOIN locations l USING(location_id) LEFT JOIN brands b USING(brand_id) LEFT JOIN colours co USING(colour_id);
CREATE OR REPLACE VIEW v_public_lost_items AS
 SELECT f.lost_id,CASE WHEN c.is_sensitive THEN c.category_name ELSE f.item_name END AS item_name,
 CASE WHEN c.is_sensitive THEN NULL ELSE f.description END AS description,
 f.category_id,CASE WHEN c.is_sensitive THEN NULL::integer ELSE f.location_id END AS location_id,
 f.brand_id,f.colour_id,f.lost_date,f.status,f.created_at,c.category_name,l.building,
 CASE WHEN c.is_sensitive THEN l.building ELSE l.location_name END AS location_name,b.brand_name,co.colour_name,co.hex_value,
 CASE WHEN c.is_sensitive THEN to_tsvector('english',c.category_name) ELSE f.search_vector END AS search_vector
 FROM lost_items f JOIN categories c USING(category_id) JOIN locations l USING(location_id) LEFT JOIN brands b USING(brand_id) LEFT JOIN colours co USING(colour_id);
`);
exports.down = () => {
  throw new Error("Forward-only migration");
};
