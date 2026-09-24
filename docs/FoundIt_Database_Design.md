# FoundIt Database Design

## Data Dictionary

### audit_log

| Column | Type | Nullable | Default |
|---|---|---|---|
| audit_id | bigint | NO | nextval('audit_log_audit_id_seq'::regclass) |
| entity_type | USER-DEFINED | NO |  |
| entity_id | integer | NO |  |
| action | character varying | NO |  |
| old_status | character varying | YES |  |
| new_status | character varying | YES |  |
| changed_by | integer | YES |  |
| detail | jsonb | YES |  |
| changed_at | timestamp with time zone | NO | now() |

### brands

| Column | Type | Nullable | Default |
|---|---|---|---|
| brand_id | integer | NO | nextval('brands_brand_id_seq'::regclass) |
| brand_name | character varying | NO |  |
| is_active | boolean | NO | true |

### categories

| Column | Type | Nullable | Default |
|---|---|---|---|
| category_id | integer | NO | nextval('categories_category_id_seq'::regclass) |
| category_name | character varying | NO |  |
| parent_id | integer | YES |  |
| requires_staff | boolean | NO | false |
| is_sensitive | boolean | NO | false |
| is_active | boolean | NO | true |

### claims

| Column | Type | Nullable | Default |
|---|---|---|---|
| claim_id | integer | NO | nextval('claims_claim_id_seq'::regclass) |
| match_id | integer | NO |  |
| claimant_id | integer | NO |  |
| proof_text | text | NO |  |
| status | USER-DEFINED | NO | 'PENDING'::claim_status |
| verifier_id | integer | YES |  |
| decision_note | character varying | YES |  |
| claimed_at | timestamp with time zone | NO | now() |
| decided_at | timestamp with time zone | YES |  |
| completed_at | timestamp with time zone | YES |  |
| found_id | integer | NO |  |

### colours

| Column | Type | Nullable | Default |
|---|---|---|---|
| colour_id | integer | NO | nextval('colours_colour_id_seq'::regclass) |
| colour_name | character varying | NO |  |
| hex_value | character | YES |  |
| is_active | boolean | NO | true |

### found_items

| Column | Type | Nullable | Default |
|---|---|---|---|
| found_id | integer | NO | nextval('found_items_found_id_seq'::regclass) |
| user_id | integer | YES |  |
| finder_note | character varying | YES |  |
| item_name | character varying | NO |  |
| category_id | integer | NO |  |
| location_id | integer | NO |  |
| colour_id | integer | YES |  |
| brand_id | integer | YES |  |
| brand_other | character varying | YES |  |
| description | text | YES |  |
| private_feature | text | NO |  |
| custody | USER-DEFINED | NO |  |
| is_high_value | boolean | NO | false |
| storage_location | character varying | YES |  |
| found_date | date | NO |  |
| found_time | time without time zone | YES |  |
| status | USER-DEFINED | NO | 'AVAILABLE'::found_status |
| returned_at | timestamp with time zone | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| search_vector | tsvector | YES |  |

### ground_truth

| Column | Type | Nullable | Default |
|---|---|---|---|
| lost_id | integer | YES |  |
| found_id | integer | YES |  |
| difficulty | character varying | YES |  |

### locations

| Column | Type | Nullable | Default |
|---|---|---|---|
| location_id | integer | NO | nextval('locations_location_id_seq'::regclass) |
| location_name | character varying | NO |  |
| building | character varying | NO |  |
| floor | character varying | YES |  |
| zone | character varying | YES |  |
| is_active | boolean | NO | true |
| created_at | timestamp with time zone | NO | now() |

### lost_items

| Column | Type | Nullable | Default |
|---|---|---|---|
| lost_id | integer | NO | nextval('lost_items_lost_id_seq'::regclass) |
| user_id | integer | NO |  |
| item_name | character varying | NO |  |
| category_id | integer | NO |  |
| location_id | integer | NO |  |
| colour_id | integer | YES |  |
| brand_id | integer | YES |  |
| brand_other | character varying | YES |  |
| description | text | YES |  |
| lost_date | date | NO |  |
| lost_time_from | time without time zone | YES |  |
| lost_time_to | time without time zone | YES |  |
| status | USER-DEFINED | NO | 'OPEN'::lost_status |
| resolved_at | timestamp with time zone | YES |  |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |
| search_vector | tsvector | YES |  |

### match_config

| Column | Type | Nullable | Default |
|---|---|---|---|
| config_key | character varying | NO |  |
| config_value | integer | NO |  |
| description | character varying | NO |  |
| version | integer | NO | 1 |
| updated_at | timestamp with time zone | NO | now() |

### matches

| Column | Type | Nullable | Default |
|---|---|---|---|
| match_id | integer | NO | nextval('matches_match_id_seq'::regclass) |
| lost_id | integer | NO |  |
| found_id | integer | NO |  |
| match_score | smallint | NO |  |
| match_band | character varying | NO |  |
| reason_json | jsonb | NO |  |
| status | USER-DEFINED | NO | 'SUGGESTED'::match_status |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

### score_bands

| Column | Type | Nullable | Default |
|---|---|---|---|
| band_name | character varying | NO |  |
| lower_bound | smallint | NO |  |
| upper_bound | smallint | NO |  |

### sessions

| Column | Type | Nullable | Default |
|---|---|---|---|
| session_id | character varying | NO |  |
| user_id | integer | NO |  |
| expires_at | timestamp with time zone | NO |  |
| created_at | timestamp with time zone | NO | now() |

### users

| Column | Type | Nullable | Default |
|---|---|---|---|
| user_id | integer | NO | nextval('users_user_id_seq'::regclass) |
| full_name | character varying | NO |  |
| email | character varying | NO |  |
| password_hash | character | NO |  |
| phone | character varying | YES |  |
| department | character varying | YES |  |
| role | USER-DEFINED | NO | 'STUDENT'::user_role |
| is_active | boolean | NO | true |
| flagged_count | smallint | NO | 0 |
| created_at | timestamp with time zone | NO | now() |
| updated_at | timestamp with time zone | NO | now() |

## Referential Policy

| Constraint Name | Table | Foreign Key | References | On Update | On Delete |
|---|---|---|---|---|---|
| fk_audit_user | audit_log | changed_by | users | CASCADE | SET NULL |
| fk_categories_parent | categories | parent_id | categories | CASCADE | RESTRICT |
| fk_claim_claimant | claims | claimant_id | users | CASCADE | RESTRICT |
| fk_claim_found | claims | found_id | found_items | CASCADE | RESTRICT |
| fk_claim_match | claims | match_id | matches | CASCADE | RESTRICT |
| fk_claim_verifier | claims | verifier_id | users | CASCADE | RESTRICT |
| fk_found_brand | found_items | brand_id | brands | CASCADE | SET NULL |
| fk_found_category | found_items | category_id | categories | CASCADE | RESTRICT |
| fk_found_colour | found_items | colour_id | colours | CASCADE | SET NULL |
| fk_found_location | found_items | location_id | locations | CASCADE | RESTRICT |
| fk_found_user | found_items | user_id | users | CASCADE | SET NULL |
| fk_lost_brand | lost_items | brand_id | brands | CASCADE | SET NULL |
| fk_lost_category | lost_items | category_id | categories | CASCADE | RESTRICT |
| fk_lost_colour | lost_items | colour_id | colours | CASCADE | SET NULL |
| fk_lost_location | lost_items | location_id | locations | CASCADE | RESTRICT |
| fk_lost_user | lost_items | user_id | users | CASCADE | RESTRICT |
| fk_match_band | matches | match_band | score_bands | CASCADE | RESTRICT |
| fk_match_found | matches | found_id | found_items | CASCADE | CASCADE |
| fk_match_lost | matches | lost_id | lost_items | CASCADE | CASCADE |
| fk_session_user | sessions | user_id | users | NO ACTION | CASCADE |
