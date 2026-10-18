# FoundIt

A working campus lost-and-found application: React frontend, Express API and PostgreSQL matching, proof-of-ownership verification, safe claim approval and an append-only audit trail.

## Deploy to Vercel

The repository includes `vercel.json` and a Node function adapter. Vercel serves the compiled React frontend from `client/dist` and routes `/api/*` to the Express API. Both run on the same origin; browser tokens and database credentials are never embedded in the client build.

1. Create a hosted PostgreSQL database. The deployed FoundIt instance uses a dedicated Neon Free database in Singapore, with Neon Auth and Realtime disabled because FoundIt has its own authentication.
2. Import `aaditgarg01/FoundIt` into Vercel from the repository root. Use Node **22.x**, framework **Vite**, build command **`npm run build:vercel`**, and output directory **`client/dist`**. These settings are also recorded in `vercel.json`.
3. Set these encrypted server environment variables before deploying:

| Variable                 | Value                                                                     |
| ------------------------ | ------------------------------------------------------------------------- |
| `DATABASE_URL`           | Pooled hosted PostgreSQL URL, including TLS parameters                    |
| `MIGRATION_DATABASE_URL` | Direct/unpooled PostgreSQL URL for migration locks                        |
| `JWT_SECRET`             | At least 32 cryptographically random characters                           |
| `DB_POOL_MAX`            | `3` connections per function instance                                     |
| `CLIENT_ORIGIN`          | Your final `https://…vercel.app` origin, if cross-origin access is needed |
| `ALLOWED_EMAIL_DOMAINS`  | Optional comma-separated institutional email domains                      |

4. Deploy. `build:vercel` validates configuration, applies forward migrations, seeds reference data idempotently, and compiles the frontend. It never seeds demo users or synthetic reports. The migration account needs permission to create roles because the original schema creates `foundit_app`.
5. Verify `/api/v1/health` returns `{ "status": "ok", "db": true }`, load `/login` directly, and create a student account through the live app.

Vercel runs the API in Singapore near the database. The connection pool is bounded and attached to Vercel's function lifecycle so idle connections are released when instances suspend. API responses use `Cache-Control: private, no-store`; security headers also cover the static frontend.

Keep production database credentials scoped to **Production**. Give preview deployments a separate database/branch before enabling their builds; never run unreviewed preview migrations against production. Migrations use the direct connection rather than a transaction-pooling proxy. The existing manual `npm run expire` command is available to an operator; this deployment does not schedule automated status-changing jobs.

Useful references: [Vite deployment](https://vercel.com/docs/frameworks/frontend/vite), [Vercel function connection pools](https://vercel.com/kb/guide/connection-pooling-with-functions), and [Neon integration](https://neon.tech/docs/guides/vercel-native-integration).

## Run locally

Requires Node.js 22 and PostgreSQL 15+.

```sh
npm ci
cp .env.example .env
```

Set `DATABASE_URL` and a random `JWT_SECRET` in `.env`. Create the database named in that URL. Generate a signing secret with:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Then:

```sh
npm run migrate
npm run seed:reference
npm run seed:demo
npm run dev
```

Open **http://localhost:5173**. Vite forwards API requests to Express on port 3000. The demo seed prints a generated password for these local demonstration accounts:

| Account                      | Role                        |
| ---------------------------- | --------------------------- |
| `ananya@demo.foundit.test`   | Student / lost-report owner |
| `rahul@demo.foundit.test`    | Student / finder            |
| `security@demo.foundit.test` | Staff verifier              |
| `admin@demo.foundit.test`    | Administrator               |

The demo seed creates six found reports and a matching lost report. It does not reset an existing item's lifecycle when rerun. Set `DEMO_PASSWORD` to choose a repeatable **local-only** demo password. Do not seed demonstration accounts on a real campus deployment.

For the compiled application, run `npm run build` followed by `npm start`, then open **http://localhost:3000**. Express serves both the frontend and API. Deep links work on refresh.

## Docker Compose

Copy `.env.example` to `.env`, set `POSTGRES_PASSWORD` and `JWT_SECRET`, then:

```sh
docker compose up --build
```

The database health check gates migrations and reference seeding; the app starts only after setup exits successfully. Open http://localhost:3000. Demo accounts are optional:

```sh
docker compose exec app node scripts/seed-demo.js
```

Docker configuration is included; container startup was not tested in the implementation environment because Docker Desktop was not running. Native PostgreSQL and the built application were tested.

## What works

- Registration, sign-in, bounded sessions, refresh, revocation and profile editing. Public registration always creates a student; staff/admin accounts are provisioned separately.
- Lost and found reporting with reference-backed fields, public/private descriptions, colours, brands, custody and high-value routing. Draft reports survive refresh within the same tab.
- Anonymous found-item intake by staff and subsequent custody updates.
- Search and combined category/location/building/colour/date filters with bounded pagination and shareable filter URLs.
- Automatic matching in either reporting order, configurable weights, confidence bands, stored explanations, dismissal and restoration.
- Claim submission, finder/staff verification, rejection, withdrawal, approval and completed handover. Contacts and exact collection locations appear only after approval.
- Ownership predicates, scoped row locks, database-enforced quotas, self-claim prevention, unique pending claims and one approved/completed claim per found item.
- Private verification details are restricted to eligible verifiers. Sensitive document listings suppress public names, descriptions and exact location identifiers.
- My reports, dashboard, verification queue, lifecycle timeline, staff analytics, ageing items and flagged-account review.
- Administrator reference creation/deactivation and scoring settings. Weights must sum to 100; thresholds must be ordered.
- Batched expiry with `SKIP LOCKED`, configurable retention, and audit entries. Run `npm run expire` from your deployment's scheduler; the web server does not schedule background jobs itself.

## Tests

Create a **separate** database whose name ends with `_test`, set `TEST_DATABASE_URL` in `.env`, then:

```sh
npm test
npm run test:mutation
npm run build
npm audit
```

`npm test` applies migrations and seeds reference data in the dedicated database. It does not reset or truncate a database, and fixture records have unique addresses. It overrides the migration connection so production migration credentials cannot redirect test setup. Use a fresh test database to reproduce a clean run.

The suite covers successful and invalid requests, sessions, authorization, privacy, matching, quotas, editing, custody, anonymous intake, expiry, audit rollback and a 50-way approval race. The concurrency suite also bypasses the approval procedure deliberately to verify that the unique index prevents double approval. The mutation check temporarily removes proof redaction, requires exactly the privacy assertion to fail, and restores the source unconditionally. Do not run it while editing `db/queries/claims.js`.

CI runs against PostgreSQL 15 and Node 22. Local verification used PostgreSQL 16 and Node 26. See [implementation notes](docs/completion.md) for details and limits.

## Evaluation and performance

Use a **disposable, reference-seeded** database for synthetic data; the seed adds records rather than replacing an existing dataset:

```sh
npm run seed:data -- --lost 200 --found 200 --seed 12345
node scripts/evaluate-matching.js
node scripts/benchmark.js
```

`seed:data` writes the generated ground-truth IDs to `db/data/ground_truth.json`. The evaluation command must run against that same database immediately after seeding. The benchmark requires a database name ending in `_test`, temporarily expands it to 10,000 rows per item relation, records timing and an `EXPLAIN (ANALYZE, BUFFERS)` result, then rolls back its data changes. Sequence values may advance after rollback.

## Structure

```text
client/              React routes, forms, components, styling and Vite build
src/                 Express routing, validation, authentication and services
db/migrations/       Forward-only schema, functions, triggers and views
db/queries/          Parameterized SQL grouped by aggregate
scripts/             Migrations, demo seeding, tests, expiry and evaluation
tests/               API, privacy, integrity and concurrency verification
docs/specs/          Authoritative product and technical specifications
```

Root-level `patch_*.js` files and historical test transcripts came from earlier development. They are not part of setup and must not be run against the completed schema. The supported test command is `npm test`.

## Deployment configuration

Use a strong secret, HTTPS at your reverse proxy, an appropriate `CLIENT_ORIGIN` and optional comma-separated `ALLOWED_EMAIL_DOMAINS`. A domain allow-list is not email ownership verification; no email delivery or institutional SSO integration is included. Password reset by email and push notifications are outside the specified MVP.

Migrations run with a database owner connection (`MIGRATION_DATABASE_URL`, falling back to `DATABASE_URL`). The original migrations create the `foundit_app` role and need permission to create roles. For a production deployment, provision a separate login inheriting `foundit_app`, use that login for `DATABASE_URL`, and keep the owner connection out of the application container. The demo Compose configuration uses its database owner for simplicity. `foundit_app` has audit read/insert access and no audit update/delete permission; an immutability trigger provides an additional guard.

Refresh tokens are hashed in the database; tokens are held in browser session storage and expire after seven days. Sign-out revokes the session immediately. The development rate limiter is per process; coordinate limits at the reverse proxy before running multiple application instances. Only log metadata is emitted; database error details and request bodies are never serialized into logs.
