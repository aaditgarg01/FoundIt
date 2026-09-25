# FoundIt API Design

## Phase 2 Implementation

This document describes the application skeleton, authentication, and endpoints implemented in Phase 2.

### 1. Application Layering

- **Middleware**: Express server setup with CORS, JSON body parser, structured logging (request IDs using `uuid`), and an error handler middleware.
- **Database Connection**: `src/db/index.js` manages the connection pool using `pg`.
- **Transactions**: Centralized `withTransaction` helper handles `BEGIN`, `COMMIT`, and `ROLLBACK` for multi-statement atomic operations.

### 2. Authentication (`/api/v1/auth`)

- `POST /register`: Accepts user details (email, password, full_name, role) and registers using `bcrypt` (cost 12).
- `POST /login`: Validates credentials with timing-equalization (hashes a dummy string if the user is not found). Issues a short-lived JWT and a refresh token.
- `POST /refresh`: Verifies the refresh token against the `sessions` relation and issues a new JWT.
- `POST /logout`: Invalidates the refresh token in the database.

### 3. Reference Data (`/api/v1/reference`)

- `GET /`: Returns the in-memory cached reference vocabularies (categories, locations, brands, colours).
- `POST /invalidate`: Admin-only endpoint to reload the reference cache directly from the database.

### 4. Items (`/api/v1/items`)

- `POST /lost`: Creates a lost item report. Protected by a transaction that also inserts an `audit_log` row and synchronously calls `generate_matches_for_lost` before returning the top match.
- `POST /found`: Creates a found item report. Validates that the public description does not duplicate the `private_feature`. Wrapped in a transaction similar to `/lost`.
- `GET /lost`, `GET /found`: Public browse endpoints powered by `v_public_lost_items` and `v_public_found_items`. Supports text search via `@@ plainto_tsquery('english', query)` using the generated `tsvector`.

### 5. Matches (`/api/v1/matches`)

- `GET /lost/:lost_id`: Returns a ranked list of matches for the specified lost item, verifying ownership in the `WHERE` clause. Returns `404 Not Found` if the item doesn't belong to the user.
- `GET /:match_id`: Returns detailed view of a single match.
- `POST /:match_id/dismiss`: Dismisses a suggested match (sets status to `REJECTED`), checking state via `FOR UPDATE` inside a transaction.

### 6. Index Evidence

See `T2.11_Index_Evidence.md` for EXPLAIN ANALYZE captures verifying that `ix_found_match_probe` and `ix_lost_match_probe` are used optimally by the planner on large sets.
