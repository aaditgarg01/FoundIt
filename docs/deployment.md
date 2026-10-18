# Vercel deployment — 19 October 2026

- Public application: https://foundit-campus.vercel.app
- Vercel project: `foundit-campus`
- Production branch: `master`
- Initial deployed implementation: `b182cacc13d87fcc7614bfd2b524ef8feeb7e6f1`
- Database: dedicated Neon Free resource `foundit-postgres`, Singapore (`sin1`)
- API function region: Singapore (`sin1`)
- Node runtime: 22.x
- Frontend: Vite build served from the CDN
- Backend: Express through `api/index.js`, with original `/api/v1` paths preserved

## Verified production behavior

The Vercel build applied all 13 existing forward migrations and seeded reference data. No demonstration users, synthetic reports or local database contents were copied to production.

Live HTTP checks returned:

| Route                                   | Expected and observed result                            |
| --------------------------------------- | ------------------------------------------------------- |
| `/`                                     | 200, application HTML                                   |
| `/login`                                | 200, application HTML on direct navigation              |
| `/api/v1/health`                        | 200, `{"status":"ok","db":true}`                        |
| `/api/v1/dashboard/summary`             | 200, empty initial production inventory                 |
| `/api/v1/reference`                     | 200; 20 categories, 75 locations, 61 brands, 25 colours |
| `/api/v1/items/found` without a session | 401, sign-in required                                   |
| Unknown API path                        | 404 JSON error                                          |
| Invalid login                           | 401, comprehensible credential error                    |

The browser rendered the public homepage with live zero-item counts and a useful empty state. Selecting the lost-report action preserved `/report/lost` as the destination through the sign-in redirect. No production records were created for smoke testing.

The deployment adapter and build configuration guards are covered by four additional automated tests. The complete suite contains 65 passing tests across three suites. [GitHub CI passed](https://github.com/aaditgarg01/FoundIt/actions/runs/39169257064) against Node 22/PostgreSQL 15.

## Configuration and operations

Database and JWT values are encrypted Vercel environment variables scoped to **Production**. They are not checked into Git or embedded in the client bundle. `MIGRATION_DATABASE_URL` uses the direct connection for migration advisory locks; runtime `DATABASE_URL` uses the pooled connection. Each API instance is limited to three database connections and uses Vercel's database-pool lifecycle helper.

Preview environments do not share production secrets. Configure a separate preview database before deploying a branch that needs the API. Build-time migrations are forward-only and reference seeding preserves existing configuration values.

No recurring, status-changing maintenance job was configured. An operator can run the existing `npm run expire` command deliberately when retention maintenance is required.

Neon Auth and Realtime are disabled; FoundIt uses its existing authentication and SQL workflows. Staff and administrator roles are assigned by the database owner after account registration.
