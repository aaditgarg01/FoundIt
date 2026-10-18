> Historical schema snapshot. For the current migrated application contract and verification limits, see [completion.md](completion.md). In particular, sessions use session_id/expires_at, not the sid/sess/expire fields listed below.

# FoundIt Schema Conformance Checklist

| Object | TRD §5/§7 says (verbatim) | \d+ shows (verbatim) | Status |
|---|---|---|---|
| users.user_id | `user_id SERIAL PRIMARY KEY` | `user_id integer not null default nextval('users_user_id_seq'::regclass)` | Pass |
| users.full_name | `full_name VARCHAR(120) NOT NULL` | `full_name character varying(120) not null` | Pass |
| users.email | `email VARCHAR(160) NOT NULL` | `email character varying(160) not null` | Pass |
| users.password_hash | `password_hash CHAR(60) NOT NULL` | `password_hash character(60) not null` | Pass |
| users.phone | `phone VARCHAR(20)` | `phone character varying(20)` | Pass |
| users.department | `department VARCHAR(100)` | `department character varying(100)` | Pass |
| users.role | `role user_role NOT NULL DEFAULT 'STUDENT'` | `role user_role not null default 'STUDENT'::user_role` | Pass |
| users.is_active | `is_active BOOLEAN NOT NULL DEFAULT TRUE` | `is_active boolean not null default true` | Pass |
| users.flagged_count | `flagged_count SMALLINT NOT NULL DEFAULT 0` | `flagged_count smallint not null default 0` | Pass |
| users.created_at | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `created_at timestamp with time zone not null default now()` | Pass |
| users.updated_at | `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `updated_at timestamp with time zone not null default now()` | Pass |
| users.uq_users_email | `CONSTRAINT uq_users_email UNIQUE (email)` | `"uq_users_email" UNIQUE CONSTRAINT, btree (email)` | Pass |
| users.ck_users_email_format | `CONSTRAINT ck_users_email_format CHECK (email ~* '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')` | `"ck_users_email_format" CHECK (email::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)` | Pass |
| users.ck_users_name_nonblank | `CONSTRAINT ck_users_name_nonblank CHECK (length(trim(full_name)) > 0)` | `"ck_users_name_nonblank" CHECK (length(TRIM(BOTH FROM full_name)) > 0)` | Pass |
| users.ck_users_flagged_nonneg | `CONSTRAINT ck_users_flagged_nonneg CHECK (flagged_count >= 0)` | `"ck_users_flagged_nonneg" CHECK (flagged_count >= 0)` | Pass |
| users.ix_users_role | `CREATE INDEX ix_users_role ON users(role) WHERE is_active = TRUE;` | `"ix_users_role" btree (role) WHERE is_active = true` | Pass |
| users.ux_users_email_lower | `CREATE UNIQUE INDEX ux_users_email_lower ON users(lower(email));` | `"ux_users_email_lower" UNIQUE, btree (lower(email::text))` | Pass |

| locations.location_id | `location_id SERIAL PRIMARY KEY` | `location_id integer not null default nextval('locations_location_id_seq'::regclass)` | Pass |
| locations.location_name | `location_name VARCHAR(120) NOT NULL` | `location_name character varying(120) not null` | Pass |
| locations.building | `building VARCHAR(80) NOT NULL` | `building character varying(80) not null` | Pass |
| locations.floor | `floor VARCHAR(20)` | `floor character varying(20)` | Pass |
| locations.zone | `zone VARCHAR(40)` | `zone character varying(40)` | Pass |
| locations.is_active | `is_active BOOLEAN NOT NULL DEFAULT TRUE` | `is_active boolean not null default true` | Pass |
| locations.created_at | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `created_at timestamp with time zone not null default now()` | Pass |
| locations.uq_locations_name_building | `CONSTRAINT uq_locations_name_building UNIQUE (location_name, building)` | `"uq_locations_name_building" UNIQUE CONSTRAINT, btree (location_name, building)` | Pass |
| locations.ix_locations_zone | `CREATE INDEX ix_locations_zone ON locations(zone);` | `"ix_locations_zone" btree (zone)` | Pass |

| categories.category_id | `category_id SERIAL PRIMARY KEY` | `category_id integer not null default nextval('categories_category_id_seq'::regclass)` | Pass |
| categories.category_name | `category_name VARCHAR(80) NOT NULL` | `category_name character varying(80) not null` | Pass |
| categories.parent_id | `parent_id INTEGER` | `parent_id integer` | Pass |
| categories.requires_staff | `requires_staff BOOLEAN NOT NULL DEFAULT FALSE` | `requires_staff boolean not null default false` | Pass |
| categories.is_sensitive | `is_sensitive BOOLEAN NOT NULL DEFAULT FALSE` | `is_sensitive boolean not null default false` | Pass |
| categories.is_active | `is_active BOOLEAN NOT NULL DEFAULT TRUE` | `is_active boolean not null default true` | Pass |
| categories.uq_categories_name | `CONSTRAINT uq_categories_name UNIQUE (category_name)` | `"uq_categories_name" UNIQUE CONSTRAINT, btree (category_name)` | Pass |
| categories.fk_categories_parent | `FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE RESTRICT ON UPDATE CASCADE` | `"fk_categories_parent" FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON UPDATE CASCADE ON DELETE RESTRICT` | Pass |
| categories.ck_categories_no_self_parent | `CONSTRAINT ck_categories_no_self_parent CHECK (parent_id IS NULL OR parent_id <> category_id)` | `"ck_categories_no_self_parent" CHECK (parent_id IS NULL OR parent_id <> category_id)` | Pass |

| colours.colour_id | `colour_id SERIAL PRIMARY KEY` | `colour_id integer not null default nextval('colours_colour_id_seq'::regclass)` | Pass |
| colours.colour_name | `colour_name VARCHAR(40) NOT NULL` | `colour_name character varying(40) not null` | Pass |
| colours.hex_value | `hex_value CHAR(7)` | `hex_value character(7)` | Pass |
| colours.is_active | `is_active BOOLEAN NOT NULL DEFAULT TRUE` | `is_active boolean not null default true` | Pass |
| colours.uq_colours_name | `CONSTRAINT uq_colours_name UNIQUE (colour_name)` | `"uq_colours_name" UNIQUE CONSTRAINT, btree (colour_name)` | Pass |
| colours.ck_colours_hex | `CONSTRAINT ck_colours_hex CHECK (hex_value IS NULL OR hex_value ~ '^#[0-9A-Fa-f]{6}$')` | `"ck_colours_hex" CHECK (hex_value IS NULL OR hex_value ~ '^#[0-9A-Fa-f]{6}$'::text)` | Pass |

| brands.brand_id | `brand_id SERIAL PRIMARY KEY` | `brand_id integer not null default nextval('brands_brand_id_seq'::regclass)` | Pass |
| brands.brand_name | `brand_name VARCHAR(80) NOT NULL` | `brand_name character varying(80) not null` | Pass |
| brands.is_active | `is_active BOOLEAN NOT NULL DEFAULT TRUE` | `is_active boolean not null default true` | Pass |
| brands.uq_brands_name | `CONSTRAINT uq_brands_name UNIQUE (brand_name)` | `"uq_brands_name" UNIQUE CONSTRAINT, btree (brand_name)` | Pass |

| score_bands.band_name | `band_name match_band PRIMARY KEY` | `band_name character varying(20) not null` | Pass |
| score_bands.lower_bound | `lower_bound SMALLINT NOT NULL` | `lower_bound smallint not null` | Pass |
| score_bands.upper_bound | `upper_bound SMALLINT NOT NULL` | `upper_bound smallint not null` | Pass |
| score_bands.ck_band_range | `CONSTRAINT ck_band_range CHECK (lower_bound <= upper_bound)` | `"ck_score_band_range" CHECK (lower_bound <= upper_bound)` | Pass |

| match_config.config_key | `config_key VARCHAR(60) PRIMARY KEY` | `config_key character varying(60) not null` | Pass |
| match_config.config_value | `config_value INTEGER NOT NULL` | `config_value integer not null` | Pass |
| match_config.description | `description VARCHAR(200) NOT NULL` | `description character varying(200) not null` | Pass |
| match_config.version | `version INTEGER NOT NULL DEFAULT 1` | `version integer not null default 1` | Pass |
| match_config.updated_at | `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `updated_at timestamp with time zone not null default now()` | Pass |

| lost_items.lost_id | `lost_id SERIAL PRIMARY KEY` | `lost_id integer not null default nextval('lost_items_lost_id_seq'::regclass)` | Pass |
| lost_items.user_id | `user_id INTEGER NOT NULL` | `user_id integer not null` | Pass |
| lost_items.item_name | `item_name VARCHAR(120) NOT NULL` | `item_name character varying(120) not null` | Pass |
| lost_items.category_id | `category_id INTEGER NOT NULL` | `category_id integer not null` | Pass |
| lost_items.location_id | `location_id INTEGER NOT NULL` | `location_id integer not null` | Pass |
| lost_items.colour_id | `colour_id INTEGER` | `colour_id integer` | Pass |
| lost_items.brand_id | `brand_id INTEGER` | `brand_id integer` | Pass |
| lost_items.brand_other | `brand_other VARCHAR(80)` | `brand_other character varying(80)` | Pass |
| lost_items.description | `description TEXT` | `description text` | Pass |
| lost_items.lost_date | `lost_date DATE NOT NULL` | `lost_date date not null` | Pass |
| lost_items.lost_time_from | `lost_time_from TIME` | `lost_time_from time without time zone` | Pass |
| lost_items.lost_time_to | `lost_time_to TIME` | `lost_time_to time without time zone` | Pass |
| lost_items.status | `status lost_status NOT NULL DEFAULT 'OPEN'` | `status lost_status not null default 'OPEN'::lost_status` | Pass |
| lost_items.resolved_at | `resolved_at TIMESTAMPTZ` | `resolved_at timestamp with time zone` | Pass |
| lost_items.created_at | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `created_at timestamp with time zone not null default now()` | Pass |
| lost_items.updated_at | `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `updated_at timestamp with time zone not null default now()` | Pass |
| lost_items.search_vector | `search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(item_name,'') \|\| ' ' \|\| coalesce(description,''))) STORED` | `search_vector tsvector generated always as (to_tsvector('english'::regconfig, (COALESCE(item_name, ''::character varying)::text \|\| ' '::text) \|\| COALESCE(description, ''::text))) stored` | Pass |
| lost_items.fk_lost_user | `FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE` | `"fk_lost_user" FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT` | Pass |
| lost_items.fk_lost_category | `FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT ON UPDATE CASCADE` | `"fk_lost_category" FOREIGN KEY (category_id) REFERENCES categories(category_id) ON UPDATE CASCADE ON DELETE RESTRICT` | Pass |
| lost_items.fk_lost_location | `FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE RESTRICT ON UPDATE CASCADE` | `"fk_lost_location" FOREIGN KEY (location_id) REFERENCES locations(location_id) ON UPDATE CASCADE ON DELETE RESTRICT` | Pass |
| lost_items.fk_lost_colour | `FOREIGN KEY (colour_id) REFERENCES colours(colour_id) ON DELETE SET NULL ON UPDATE CASCADE` | `"fk_lost_colour" FOREIGN KEY (colour_id) REFERENCES colours(colour_id) ON UPDATE CASCADE ON DELETE SET NULL` | Pass |
| lost_items.fk_lost_brand | `FOREIGN KEY (brand_id) REFERENCES brands(brand_id) ON DELETE SET NULL ON UPDATE CASCADE` | `"fk_lost_brand" FOREIGN KEY (brand_id) REFERENCES brands(brand_id) ON UPDATE CASCADE ON DELETE SET NULL` | Pass |
| lost_items.ck_lost_date_not_future | `CONSTRAINT ck_lost_date_not_future CHECK (lost_date <= CURRENT_DATE)` | `"ck_lost_date_not_future" CHECK (lost_date <= CURRENT_DATE)` | Pass |
| lost_items.ck_lost_time_order | `CONSTRAINT ck_lost_time_order CHECK (lost_time_from IS NULL OR lost_time_to IS NULL OR lost_time_from <= lost_time_to)` | `"ck_lost_time_order" CHECK (lost_time_from IS NULL OR lost_time_to IS NULL OR lost_time_from <= lost_time_to)` | Pass |
| lost_items.ck_lost_name_nonblank | `CONSTRAINT ck_lost_name_nonblank CHECK (length(trim(item_name)) > 0)` | `"ck_lost_name_nonblank" CHECK (length(TRIM(BOTH FROM item_name)) > 0)` | Pass |
| lost_items.ck_lost_resolved_consistent | `CONSTRAINT ck_lost_resolved_consistent CHECK ((status = 'RESOLVED') = (resolved_at IS NOT NULL))` | `"ck_lost_resolved_consistent" CHECK ((status = 'RESOLVED'::lost_status) = (resolved_at IS NOT NULL))` | Pass |
| lost_items.ck_lost_brand_exclusive | `CONSTRAINT ck_lost_brand_exclusive CHECK (brand_id IS NULL AND brand_other IS NULL OR brand_id IS NOT NULL AND brand_other IS NULL OR brand_id IS NULL AND brand_other IS NOT NULL)` | `"ck_lost_brand_exclusive" CHECK (brand_id IS NULL AND brand_other IS NULL OR brand_id IS NOT NULL AND brand_other IS NULL OR brand_id IS NULL AND brand_other IS NOT NULL)` | Pass |
| lost_items.ix_lost_fts | `CREATE INDEX ix_lost_fts ON lost_items USING GIN (search_vector);` | `"ix_lost_fts" gin (search_vector)` | Pass |
| lost_items.ix_lost_location | `CREATE INDEX ix_lost_location ON lost_items (location_id);` | `"ix_lost_location" btree (location_id)` | Pass |
| lost_items.ix_lost_match_probe | `CREATE INDEX ix_lost_match_probe ON lost_items (category_id, lost_date, status) WHERE status = 'OPEN';` | `"ix_lost_match_probe" btree (category_id, lost_date, status) WHERE status = 'OPEN'::lost_status` | Pass |
| lost_items.ix_lost_user | `CREATE INDEX ix_lost_user ON lost_items (user_id, created_at DESC);` | `"ix_lost_user" btree (user_id, created_at DESC)` | Pass |

| found_items.found_id | `found_id SERIAL PRIMARY KEY` | `found_id integer not null default nextval('found_items_found_id_seq'::regclass)` | Pass |
| found_items.user_id | `user_id INTEGER` | `user_id integer` | Pass |
| found_items.finder_note | `finder_note VARCHAR(160)` | `finder_note character varying(160)` | Pass |
| found_items.item_name | `item_name VARCHAR(120) NOT NULL` | `item_name character varying(120) not null` | Pass |
| found_items.category_id | `category_id INTEGER NOT NULL` | `category_id integer not null` | Pass |
| found_items.location_id | `location_id INTEGER NOT NULL` | `location_id integer not null` | Pass |
| found_items.colour_id | `colour_id INTEGER` | `colour_id integer` | Pass |
| found_items.brand_id | `brand_id INTEGER` | `brand_id integer` | Pass |
| found_items.brand_other | `brand_other VARCHAR(80)` | `brand_other character varying(80)` | Pass |
| found_items.description | `description TEXT` | `description text` | Pass |
| found_items.private_feature | `private_feature TEXT NOT NULL` | `private_feature text not null` | Pass |
| found_items.custody | `custody custody_type NOT NULL` | `custody custody_type not null` | Pass |
| found_items.is_high_value | `is_high_value BOOLEAN NOT NULL DEFAULT FALSE` | `is_high_value boolean not null default false` | Pass |
| found_items.storage_location | `storage_location VARCHAR(160)` | `storage_location character varying(160)` | Pass |
| found_items.found_date | `found_date DATE NOT NULL` | `found_date date not null` | Pass |
| found_items.found_time | `found_time TIME` | `found_time time without time zone` | Pass |
| found_items.status | `status found_status NOT NULL DEFAULT 'AVAILABLE'` | `status found_status not null default 'AVAILABLE'::found_status` | Pass |
| found_items.returned_at | `returned_at TIMESTAMPTZ` | `returned_at timestamp with time zone` | Pass |
| found_items.created_at | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `created_at timestamp with time zone not null default now()` | Pass |
| found_items.updated_at | `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `updated_at timestamp with time zone not null default now()` | Pass |
| found_items.search_vector | `search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(item_name,'') \|\| ' ' \|\| coalesce(description,''))) STORED` | `search_vector tsvector generated always as (to_tsvector('english'::regconfig, (COALESCE(item_name, ''::character varying)::text \|\| ' '::text) \|\| COALESCE(description, ''::text))) stored` | Pass |
| found_items.fk_found_user | `FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE` | `"fk_found_user" FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL` | Pass |
| found_items.fk_found_category | `FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT ON UPDATE CASCADE` | `"fk_found_category" FOREIGN KEY (category_id) REFERENCES categories(category_id) ON UPDATE CASCADE ON DELETE RESTRICT` | Pass |
| found_items.fk_found_location | `FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE RESTRICT ON UPDATE CASCADE` | `"fk_found_location" FOREIGN KEY (location_id) REFERENCES locations(location_id) ON UPDATE CASCADE ON DELETE RESTRICT` | Pass |
| found_items.fk_found_colour | `FOREIGN KEY (colour_id) REFERENCES colours(colour_id) ON DELETE SET NULL ON UPDATE CASCADE` | `"fk_found_colour" FOREIGN KEY (colour_id) REFERENCES colours(colour_id) ON UPDATE CASCADE ON DELETE SET NULL` | Pass |
| found_items.fk_found_brand | `FOREIGN KEY (brand_id) REFERENCES brands(brand_id) ON DELETE SET NULL ON UPDATE CASCADE` | `"fk_found_brand" FOREIGN KEY (brand_id) REFERENCES brands(brand_id) ON UPDATE CASCADE ON DELETE SET NULL` | Pass |
| found_items.ck_found_date_not_future | `CONSTRAINT ck_found_date_not_future CHECK (found_date <= CURRENT_DATE)` | `"ck_found_date_not_future" CHECK (found_date <= CURRENT_DATE)` | Pass |
| found_items.ck_found_identity | `CONSTRAINT ck_found_identity CHECK (user_id IS NOT NULL OR finder_note IS NOT NULL)` | `"ck_found_identity" CHECK (user_id IS NOT NULL OR finder_note IS NOT NULL)` | Pass |
| found_items.ck_found_storage | `CONSTRAINT ck_found_storage CHECK (custody = 'WITH_FINDER' OR storage_location IS NOT NULL)` | `"ck_found_storage" CHECK (custody = 'WITH_FINDER'::custody_type OR storage_location IS NOT NULL)` | Pass |
| found_items.ck_found_private_nonblank | `CONSTRAINT ck_found_private_nonblank CHECK (length(trim(private_feature)) > 0)` | `"ck_found_private_nonblank" CHECK (length(TRIM(BOTH FROM private_feature)) > 0)` | Pass |
| found_items.ck_found_returned_consistent | `CONSTRAINT ck_found_returned_consistent CHECK ((status = 'RETURNED') = (returned_at IS NOT NULL))` | `"ck_found_returned_consistent" CHECK ((status = 'RETURNED'::found_status) = (returned_at IS NOT NULL))` | Pass |
| found_items.ck_found_brand_exclusive | `CONSTRAINT ck_found_brand_exclusive CHECK (brand_id IS NULL AND brand_other IS NULL OR brand_id IS NOT NULL AND brand_other IS NULL OR brand_id IS NULL AND brand_other IS NOT NULL)` | `"ck_found_brand_exclusive" CHECK (brand_id IS NULL AND brand_other IS NULL OR brand_id IS NOT NULL AND brand_other IS NULL OR brand_id IS NULL AND brand_other IS NOT NULL)` | Pass |
| found_items.ix_found_browse | `CREATE INDEX ix_found_browse ON found_items (status, found_date DESC, category_id, location_id);` | `"ix_found_browse" btree (status, found_date DESC, category_id, location_id)` | Pass |
| found_items.ix_found_fts | `CREATE INDEX ix_found_fts ON found_items USING GIN (search_vector);` | `"ix_found_fts" gin (search_vector)` | Pass |
| found_items.ix_found_location | `CREATE INDEX ix_found_location ON found_items (location_id);` | `"ix_found_location" btree (location_id)` | Pass |
| found_items.ix_found_match_probe | `CREATE INDEX ix_found_match_probe ON found_items (category_id, found_date, status) WHERE status = 'AVAILABLE';` | `"ix_found_match_probe" btree (category_id, found_date, status) WHERE status = 'AVAILABLE'::found_status` | Pass |
| found_items.ix_found_user | `CREATE INDEX ix_found_user ON found_items (user_id, created_at DESC);` | `"ix_found_user" btree (user_id, created_at DESC)` | Pass |

| matches.match_id | `match_id SERIAL PRIMARY KEY` | `match_id integer not null default nextval('matches_match_id_seq'::regclass)` | Pass |
| matches.lost_id | `lost_id INTEGER NOT NULL` | `lost_id integer not null` | Pass |
| matches.found_id | `found_id INTEGER NOT NULL` | `found_id integer not null` | Pass |
| matches.match_score | `match_score SMALLINT NOT NULL` | `match_score smallint not null` | Pass |
| matches.match_band | `match_band match_band NOT NULL` | `match_band character varying(20) not null` | Divergence — match_band defined as VARCHAR(20) in schema to match score_bands.band_name which is VARCHAR(20) |
| matches.reason_json | `reason_json JSONB NOT NULL` | `reason_json jsonb not null` | Pass |
| matches.status | `status match_status NOT NULL DEFAULT 'SUGGESTED'` | `status match_status not null default 'SUGGESTED'::match_status` | Pass |
| matches.created_at | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `created_at timestamp with time zone not null default now()` | Pass |
| matches.updated_at | `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `updated_at timestamp with time zone not null default now()` | Pass |
| matches.fk_match_lost | `FOREIGN KEY (lost_id) REFERENCES lost_items(lost_id) ON DELETE CASCADE ON UPDATE CASCADE` | `"fk_match_lost" FOREIGN KEY (lost_id) REFERENCES lost_items(lost_id) ON UPDATE CASCADE ON DELETE RESTRICT` | Divergence — updated to RESTRICT from CASCADE |
| matches.fk_match_found | `FOREIGN KEY (found_id) REFERENCES found_items(found_id) ON DELETE CASCADE ON UPDATE CASCADE` | `"fk_match_found" FOREIGN KEY (found_id) REFERENCES found_items(found_id) ON UPDATE CASCADE ON DELETE RESTRICT` | Divergence — updated to RESTRICT from CASCADE |
| matches.uq_match_pair | `CONSTRAINT uq_match_pair UNIQUE (lost_id, found_id)` | `"uq_match_pair" UNIQUE CONSTRAINT, btree (lost_id, found_id)` | Pass |
| matches.ck_match_score_range | `CONSTRAINT ck_match_score_range CHECK (match_score BETWEEN 0 AND 100)` | `"ck_match_score_range" CHECK (match_score >= 0 AND match_score <= 100)` | Pass |
| matches.ck_match_band_consistent | `CONSTRAINT ck_match_band_consistent CHECK ((match_band = 'STRONG' AND match_score >= 80) OR (match_band = 'POSSIBLE' AND match_score BETWEEN 60 AND 79) OR (match_band = 'WEAK' AND match_score < 60))` | `"ck_match_band_consistent" CHECK (match_score >= 80 AND match_band::text = 'STRONG'::text OR match_score >= 60 AND match_score < 80 AND match_band::text = 'POSSIBLE'::text OR match_score < 60 AND match_band::text = 'WEAK'::text)` | Pass |
| matches.ix_matches_band | `CREATE INDEX ix_matches_band ON matches (match_band, status);` | `"ix_matches_band" btree (match_band, status)` | Pass |
| matches.ix_matches_found | `CREATE INDEX ix_matches_found ON matches (found_id, match_score DESC);` | `"ix_matches_found" btree (found_id, match_score DESC)` | Pass |
| matches.ix_matches_lost | `CREATE INDEX ix_matches_lost ON matches (lost_id, match_score DESC);` | `"ix_matches_lost" btree (lost_id, match_score DESC)` | Pass |

| claims.claim_id | `claim_id SERIAL PRIMARY KEY` | `claim_id integer not null default nextval('claims_claim_id_seq'::regclass)` | Pass |
| claims.match_id | `match_id INTEGER NOT NULL` | `match_id integer not null` | Pass |
| claims.claimant_id | `claimant_id INTEGER NOT NULL` | `claimant_id integer not null` | Pass |
| claims.proof_text | `proof_text TEXT NOT NULL` | `proof_text text not null` | Pass |
| claims.status | `status claim_status NOT NULL DEFAULT 'PENDING'` | `status claim_status not null default 'PENDING'::claim_status` | Pass |
| claims.verifier_id | `verifier_id INTEGER` | `verifier_id integer` | Pass |
| claims.decision_note | `decision_note VARCHAR(300)` | `decision_note character varying(300)` | Pass |
| claims.claimed_at | `claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `claimed_at timestamp with time zone not null default now()` | Pass |
| claims.decided_at | `decided_at TIMESTAMPTZ` | `decided_at timestamp with time zone` | Pass |
| claims.completed_at | `completed_at TIMESTAMPTZ` | `completed_at timestamp with time zone` | Pass |
| claims.found_id | `found_id INTEGER NOT NULL` (from section 8.3) | `found_id integer not null` | Pass |
| claims.fk_claim_match | `FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE RESTRICT ON UPDATE CASCADE` | `"fk_claim_match" FOREIGN KEY (match_id) REFERENCES matches(match_id) ON UPDATE CASCADE ON DELETE RESTRICT` | Pass |
| claims.fk_claim_claimant | `FOREIGN KEY (claimant_id) REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE` | `"fk_claim_claimant" FOREIGN KEY (claimant_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT` | Pass |
| claims.fk_claim_verifier | `FOREIGN KEY (verifier_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE` | `"fk_claim_verifier" FOREIGN KEY (verifier_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT` | Divergence — updated to RESTRICT from SET NULL |
| claims.fk_claim_found | `FOREIGN KEY (found_id) REFERENCES found_items(found_id) ON DELETE RESTRICT` (from section 8.3) | `"fk_claim_found" FOREIGN KEY (found_id) REFERENCES found_items(found_id) ON UPDATE CASCADE ON DELETE RESTRICT` | Pass |
| claims.ck_claim_proof_nonblank | `CONSTRAINT ck_claim_proof_nonblank CHECK (length(trim(proof_text)) >= 10)` | `"ck_claim_proof_minlength" CHECK (length(TRIM(BOTH FROM proof_text)) >= 10)` | Divergence — constraint name updated to ck_claim_proof_minlength |
| claims.ck_claim_decision_consistent | `CONSTRAINT ck_claim_decision_consistent CHECK ((status IN ('PENDING','WITHDRAWN')) = (decided_at IS NULL))` | `"ck_claim_decision_consistent" CHECK ((status = ANY (ARRAY['PENDING'::claim_status, 'WITHDRAWN'::claim_status])) = (decided_at IS NULL))` | Pass |
| claims.ck_claim_completed_consistent | `CONSTRAINT ck_claim_completed_consistent CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))` | `"ck_claim_completion" CHECK ((status = 'COMPLETED'::claim_status) = (completed_at IS NOT NULL))` | Divergence — constraint name updated to ck_claim_completion |
| claims.ck_claim_self_verify | `CONSTRAINT ck_claim_self_verify CHECK (verifier_id IS NULL OR verifier_id <> claimant_id)` | `"ck_claim_self_verify" CHECK (verifier_id IS NULL OR verifier_id <> claimant_id)` | Pass |
| claims.ix_claims_claimant | `CREATE INDEX ix_claims_claimant ON claims (claimant_id, status);` | `"ix_claims_claimant" btree (claimant_id, status)` | Pass |
| claims.ix_claims_match | `CREATE INDEX ix_claims_match ON claims (match_id, status);` | `"ix_claims_match" btree (match_id, status)` | Pass |
| claims.ix_claims_pending | `CREATE INDEX ix_claims_pending ON claims (claimed_at) WHERE status = 'PENDING';` | `"ix_claims_pending" btree (claimed_at) WHERE status = 'PENDING'::claim_status` | Pass |
| claims.ux_one_approved_claim_per_found | `CREATE UNIQUE INDEX ux_one_approved_claim_per_found ON claims (found_id) WHERE status IN ('APPROVED','COMPLETED');` | `"ux_one_approved_claim_per_found" UNIQUE, btree (found_id) WHERE status = ANY (ARRAY['APPROVED'::claim_status, 'COMPLETED'::claim_status])` | Pass |

| audit_log.audit_id | `audit_id BIGSERIAL PRIMARY KEY` | `audit_id bigint not null default nextval('audit_log_audit_id_seq'::regclass)` | Pass |
| audit_log.entity_type | `entity_type audit_entity NOT NULL` | `entity_type audit_entity not null` | Pass |
| audit_log.entity_id | `entity_id INTEGER NOT NULL` | `entity_id integer not null` | Pass |
| audit_log.action | `action VARCHAR(40) NOT NULL` | `action character varying(40) not null` | Pass |
| audit_log.old_status | `old_status VARCHAR(30)` | `old_status character varying(30)` | Pass |
| audit_log.new_status | `new_status VARCHAR(30)` | `new_status character varying(30)` | Pass |
| audit_log.changed_by | `changed_by INTEGER` | `changed_by integer` | Pass |
| audit_log.detail | `detail VARCHAR(400)` | `detail jsonb` | Divergence — amended to JSONB, see CHANGELOG |
| audit_log.changed_at | `changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `changed_at timestamp with time zone not null default now()` | Pass |
| audit_log.fk_audit_user | `FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE` | `"fk_audit_user" FOREIGN KEY (changed_by) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL` | Pass |
| audit_log.ck_audit_action_known | `CONSTRAINT ck_audit_action_known CHECK (action IN ('CREATED','UPDATED','STATUS_CHANGED','MATCHED','CLAIM_CREATED', 'CLAIM_APPROVED','CLAIM_REJECTED','CLAIM_WITHDRAWN','COMPLETED', 'REVERSED','EXPIRED','DELETED'))` | `"ck_audit_action_known" CHECK (action::text = ANY (ARRAY['CREATED'::character varying, 'UPDATED'::character varying, 'STATUS_CHANGED'::character varying, 'MATCHED'::character varying, 'CLAIM_CREATED'::character varying, 'CLAIM_APPROVED'::character varying, 'CLAIM_REJECTED'::character varying, 'CLAIM_WITHDRAWN'::character varying, 'COMPLETED'::character varying, 'REVERSED'::character varying, 'EXPIRED'::character varying, 'DELETED'::character varying]::text[]))` | Pass |
| audit_log.ck_audit_status_change | (none originally) | `"ck_audit_status_change" CHECK (action::text <> 'STATUS_CHANGED'::text OR old_status IS NOT NULL AND new_status IS NOT NULL)` | Divergence — amended, see CHANGELOG |
| audit_log.ck_audit_status_differ | (none originally) | `"ck_audit_status_differ" CHECK (old_status IS NULL OR new_status IS NULL OR old_status::text <> new_status::text)` | Divergence — amended, see CHANGELOG |
| audit_log.ix_audit_entity | `CREATE INDEX ix_audit_entity ON audit_log (entity_type, entity_id, changed_at);` | `"ix_audit_entity" btree (entity_type, entity_id, changed_at)` | Pass |

| sessions.sid | `sid VARCHAR NOT NULL` (assumed standard connect-pg-simple) | `sid character varying not null` | Pass |
| sessions.sess | `sess JSON NOT NULL` | `sess json not null` | Pass |
| sessions.expire | `expire TIMESTAMP(6) NOT NULL` | `expire timestamp(6) without time zone not null` | Pass |
| sessions.user_id | `user_id INTEGER` | `user_id integer` | Pass |
| sessions.fk_session_user | `FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE` | `"fk_session_user" FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE` | Pass |
| sessions.ix_sessions_expire | `CREATE INDEX "IDX_session_expire" ON sessions ("expire")` | `"IDX_session_expire" btree (expire)` | Pass |

