# Finalizing Phase 1

This plan covers the remaining items required to complete Phase 1 before moving to Phase 2, as requested.

## Open Questions
None.

## Proposed Changes

### Database Migrations
#### [MODIFY] [1789895738000_matching-engine.js](file:///Users/aaditgarg/Desktop/DBMS/db/migrations/1789895738000_matching-engine.js)
- Add a prominent block comment stating that the matching engine is UNVERIFIED pending T2.8.

### Data Seeding
#### [MODIFY] [seed_reference.js](file:///Users/aaditgarg/Desktop/DBMS/db/scripts/seed_reference.js)
- Replace generic "Room 101" location filler with real named places (60-80 specific places).
- Assign individual weights per location to generate concentrated volume for matching rather than weighting by building alone.

#### [MODIFY] [seed_data.js](file:///Users/aaditgarg/Desktop/DBMS/db/scripts/seed_data.js)
- Write generated `ground_truth.json` to `db/data/ground_truth.json` rather than the repository root.

### Constraint Testing
#### [MODIFY] [negative_tests.sql](file:///Users/aaditgarg/Desktop/DBMS/db/tests/negative_tests.sql)
- Fix the `ck_lost_time_order` test by explicitly passing `lost_time_from` and `lost_time_to` (this was partially done in a previous fix, but will be audited).
- Audit all 25 existing assertions to ensure their setup data isolates the target constraint, such that only the target constraint can fire.
- Extend test suite with ~20 additional assertions for full 45-constraint coverage:
  - `ux_one_approved_claim_per_found` (with both 'APPROVED' and 'COMPLETED' cases).
  - `ck_found_identity`.
  - All missing `uq_` constraints (`uq_locations_name_building`, `uq_categories_name`, `uq_colours_name`, `uq_brands_name`).
  - `ck_score_band_range`.
  - All 18 `fk_` constraints across all tables (using `SQLSTATE 23503`).

#### [MODIFY] [test_constraints.sh](file:///Users/aaditgarg/Desktop/DBMS/db/scripts/test_constraints.sh)
- Expand the meta-test harness (which drops constraints, runs tests, and restores them) to automatically verify the sensitivity of **all** covered constraints in the suite rather than just three.

### Documentation
#### [MODIFY] [FoundIt_Database_Design.md](file:///Users/aaditgarg/Desktop/DBMS/docs/FoundIt_Database_Design.md)
- Append the full **Data Dictionary**: every column with its type, constraint, and business purpose.
- Append the **Referential Policy Table**: all 18 foreign keys mapped with their `ON DELETE` action and the functional justification for that policy.
- Link to the conformance checklist.

## Verification Plan

### Automated Tests
- Run `npm run seed:reference` and `npm run seed:data` to verify the new skewed location distribution (verify by querying `SELECT location_name, count(*) ...`).
- Run `./db/scripts/test_constraints.sh` to execute the 45+ constraint tests.
- Run the full meta-test script dropping all 45 constraints and asserting 45 named failures.

### Manual Verification
- Output the `git log` and new distributions for `dist_locations.txt`.
