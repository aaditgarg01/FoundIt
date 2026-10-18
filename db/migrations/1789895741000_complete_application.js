// FR-3.6, FR-5, FR-6, FR-7: forward-only repair of the application contract.
exports.up = (pgm) =>
  pgm.sql(`
CREATE VIEW v_public_found_items AS
 SELECT f.found_id, CASE WHEN c.is_sensitive THEN c.category_name ELSE f.item_name END AS item_name,
 CASE WHEN c.is_sensitive THEN NULL ELSE f.description END AS description,
 f.category_id, f.location_id, f.brand_id, f.colour_id, f.found_date, f.custody,
 f.status, f.created_at, c.category_name, l.building,
 CASE WHEN c.is_sensitive THEN l.building ELSE l.location_name END AS location_name,
 b.brand_name, co.colour_name, co.hex_value,
 CASE WHEN c.is_sensitive THEN to_tsvector('english', c.category_name) ELSE f.search_vector END AS search_vector
 FROM found_items f JOIN categories c USING(category_id) JOIN locations l USING(location_id)
 LEFT JOIN brands b USING(brand_id) LEFT JOIN colours co USING(colour_id);
CREATE VIEW v_public_lost_items AS
 SELECT f.lost_id, CASE WHEN c.is_sensitive THEN c.category_name ELSE f.item_name END AS item_name,
 CASE WHEN c.is_sensitive THEN NULL ELSE f.description END AS description,
 f.category_id, f.location_id, f.brand_id, f.colour_id, f.lost_date,
 f.status, f.created_at, c.category_name, l.building,
 CASE WHEN c.is_sensitive THEN l.building ELSE l.location_name END AS location_name,
 b.brand_name, co.colour_name, co.hex_value,
 CASE WHEN c.is_sensitive THEN to_tsvector('english', c.category_name) ELSE f.search_vector END AS search_vector
 FROM lost_items f JOIN categories c USING(category_id) JOIN locations l USING(location_id)
 LEFT JOIN brands b USING(brand_id) LEFT JOIN colours co USING(colour_id);

ALTER TABLE matches DROP CONSTRAINT ck_match_band_consistent;
ALTER TABLE found_items ADD CONSTRAINT ck_found_name_nonblank CHECK(length(trim(item_name)) > 0);
ALTER TABLE found_items ADD CONSTRAINT ck_found_private_separate CHECK(description IS NULL OR position(lower(trim(private_feature)) in lower(description)) = 0);
CREATE UNIQUE INDEX ux_claim_pending_match ON claims(match_id) WHERE status = 'PENDING';
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO foundit_app;
GRANT SELECT ON v_public_found_items, v_public_lost_items TO foundit_app;

CREATE OR REPLACE FUNCTION generate_matches_for_lost(p_lost_id INTEGER) RETURNS INTEGER LANGUAGE plpgsql AS $$
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
 WHERE l.lost_id=p_lost_id AND l.status='OPEN'
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
CREATE FUNCTION generate_matches_for_found(p_found_id INTEGER) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_id INTEGER; n INTEGER:=0;
BEGIN
 FOR v_id IN SELECT l.lost_id FROM lost_items l JOIN found_items f ON f.found_id=p_found_id
 WHERE l.status='OPEN' AND (l.category_id=f.category_id OR (l.location_id=f.location_id AND l.colour_id=f.colour_id))
 LOOP n:=n+generate_matches_for_lost(v_id); END LOOP;
 RETURN n;
END $$;

-- Enforce ownership, quotas and availability even for direct SQL callers.
-- Advisory locks serialize a claimant's quota across different found items.
CREATE FUNCTION guard_claim_fn() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_status found_status; v_limit INTEGER;
BEGIN
 SELECT status INTO v_status FROM found_items WHERE found_id=NEW.found_id FOR UPDATE;
 PERFORM pg_advisory_xact_lock(20401,NEW.claimant_id);
 IF v_status IS DISTINCT FROM 'AVAILABLE' THEN RAISE EXCEPTION 'ITEM_NOT_AVAILABLE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM matches m JOIN lost_items l USING(lost_id)
 WHERE m.match_id=NEW.match_id AND l.user_id=NEW.claimant_id AND l.status='OPEN' AND m.status='SUGGESTED') THEN RAISE EXCEPTION 'MATCH_NOT_AVAILABLE'; END IF;
 SELECT config_value INTO v_limit FROM match_config WHERE config_key='MAX_PENDING_CLAIMS';
 IF (SELECT count(*) FROM claims WHERE claimant_id=NEW.claimant_id AND status='PENDING') >= v_limit THEN RAISE EXCEPTION 'MAX_PENDING_CLAIMS'; END IF;
 IF (SELECT count(*) FROM claims WHERE claimant_id=NEW.claimant_id AND found_id=NEW.found_id AND status='REJECTED' AND decision_note IS DISTINCT FROM 'Item claimed by another verified owner')>=3 THEN RAISE EXCEPTION 'MAX_ITEM_ATTEMPTS'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_claims_guard BEFORE INSERT ON claims FOR EACH ROW EXECUTE FUNCTION guard_claim_fn();
CREATE TRIGGER trg_claims_denormalise_found_update BEFORE UPDATE OF match_id,found_id ON claims FOR EACH ROW EXECUTE FUNCTION trg_claims_denormalise_found_fn();

-- Every lifecycle write is audited inside the writing transaction.
CREATE FUNCTION audit_lifecycle_fn() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_old TEXT; v_new TEXT; v_id INTEGER; v_entity audit_entity; v_action TEXT;
BEGIN
 v_entity:=TG_ARGV[0]::audit_entity; v_id:=(to_jsonb(NEW)->>TG_ARGV[1])::int;
 v_new:=NEW.status::text;
 IF TG_OP='INSERT' THEN v_action:='CREATED';
 ELSE v_old:=OLD.status::text; IF v_old=v_new THEN RETURN NEW; END IF; v_action:='STATUS_CHANGED'; END IF;
 INSERT INTO audit_log(entity_type,entity_id,action,old_status,new_status,changed_by)
 VALUES(v_entity,v_id,v_action,v_old,v_new,nullif(current_setting('app.actor_id',true),'')::int);
 RETURN NEW;
END $$;
CREATE TRIGGER trg_audit_lost AFTER INSERT OR UPDATE ON lost_items FOR EACH ROW EXECUTE FUNCTION audit_lifecycle_fn('LOST_ITEM','lost_id');
CREATE TRIGGER trg_audit_found AFTER INSERT OR UPDATE ON found_items FOR EACH ROW EXECUTE FUNCTION audit_lifecycle_fn('FOUND_ITEM','found_id');
CREATE TRIGGER trg_audit_claim AFTER INSERT OR UPDATE ON claims FOR EACH ROW EXECUTE FUNCTION audit_lifecycle_fn('CLAIM','claim_id');
CREATE TRIGGER trg_audit_match AFTER INSERT OR UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION audit_lifecycle_fn('MATCH','match_id');

CREATE OR REPLACE PROCEDURE approve_claim(p_claim_id INTEGER,p_verifier_id INTEGER) LANGUAGE plpgsql AS $$
DECLARE v_found found_items%ROWTYPE; v_claim claims%ROWTYPE; v_lost INTEGER;
BEGIN
 SELECT f.* INTO v_found FROM found_items f WHERE f.found_id=(SELECT found_id FROM claims WHERE claim_id=p_claim_id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLAIM_NOT_FOUND'; END IF;
 IF NOT EXISTS(SELECT 1 FROM users u JOIN categories cat ON cat.category_id=v_found.category_id
 JOIN claims c ON c.claim_id=p_claim_id
 WHERE u.user_id=p_verifier_id AND u.is_active AND c.claimant_id<>u.user_id
 AND (u.role IN ('STAFF','ADMIN') OR (v_found.user_id=u.user_id AND NOT cat.requires_staff AND NOT v_found.is_high_value AND v_found.custody='WITH_FINDER'))) THEN RAISE EXCEPTION 'CLAIM_NOT_FOUND'; END IF;
 IF v_found.status<>'AVAILABLE' THEN RAISE EXCEPTION 'ITEM_NOT_AVAILABLE'; END IF;
 PERFORM 1 FROM claims WHERE found_id=v_found.found_id ORDER BY claim_id FOR UPDATE;
 SELECT * INTO v_claim FROM claims WHERE claim_id=p_claim_id;
 IF v_claim.status<>'PENDING' THEN RAISE EXCEPTION 'CLAIM_NOT_PENDING'; END IF;
 SELECT lost_id INTO v_lost FROM matches WHERE match_id=v_claim.match_id;
 PERFORM 1 FROM lost_items WHERE lost_id=v_lost FOR UPDATE;
 PERFORM set_config('app.actor_id',p_verifier_id::text,true);
 UPDATE claims SET status='APPROVED',verifier_id=p_verifier_id,decided_at=NOW() WHERE claim_id=p_claim_id;
 UPDATE claims SET status='REJECTED',decided_at=NOW(),decision_note='Item claimed by another verified owner'
 WHERE found_id=v_found.found_id AND status='PENDING' AND claim_id<>p_claim_id;
 UPDATE found_items SET status='CLAIMED',updated_at=NOW() WHERE found_id=v_found.found_id;
 UPDATE lost_items SET status='MATCHED',updated_at=NOW() WHERE lost_id=v_lost;
 UPDATE matches SET status=CASE WHEN match_id=v_claim.match_id THEN 'CONFIRMED'::match_status ELSE 'INVALIDATED'::match_status END,updated_at=NOW()
 WHERE found_id=v_found.found_id AND status IN ('SUGGESTED','CLAIMED');
END $$;
`);
exports.down = () => {
  throw new Error("Forward-only migration");
};
