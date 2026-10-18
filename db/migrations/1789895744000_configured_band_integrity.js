// FR-5.6: configured bands need a database guard after replacing fixed thresholds.
exports.up = (pgm) =>
  pgm.sql(`
CREATE FUNCTION guard_match_band_fn() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM score_bands b WHERE b.band_name=NEW.match_band AND NEW.match_score BETWEEN b.lower_bound AND b.upper_bound) THEN
 RAISE EXCEPTION 'Match band does not agree with configured score range' USING ERRCODE='23514',CONSTRAINT='ck_match_band_configured';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_match_band_configured BEFORE INSERT OR UPDATE OF match_score,match_band ON matches FOR EACH ROW EXECUTE FUNCTION guard_match_band_fn();
ALTER TABLE match_config ADD CONSTRAINT ck_match_config_range CHECK(config_value BETWEEN 0 AND 365 AND (config_key NOT LIKE 'W_%' OR config_value<=100));
`);
exports.down = () => {
  throw new Error("Forward-only migration");
};
