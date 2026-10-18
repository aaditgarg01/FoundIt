# Completed application — 18 October 2026

## Scope and requirement mapping

The implementation adds the missing browser application and connects the existing database deliverables to usable workflows. The six baseline specifications remain the product reference; this file records implementation decisions and verification limits.

| Requirements | Implementation                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-1.1–1.7   | Student-only registration, case-insensitive identity, bcrypt cost 12, database-backed JWT sessions, revocation, role changes and profile audit |
| FR-2.1–2.11  | Structured lost reports, optional time window, matching, edit/withdraw, retention job                                                          |
| FR-3.1–3.9   | Found reports, hidden identifying detail, custody/storage, high-value flag, staff anonymous intake                                             |
| FR-4.1–4.6   | Authenticated browse/search, combined filters, bounded pages, public views and count on empty pages                                            |
| FR-5.1–5.10  | Config-driven deterministic SQL scoring, anchored reverse matching, persisted explanations, bands, idempotence, dismissal/restoration          |
| FR-6.1–6.10  | Ownership proof, scoped verification, competing claims, transaction-safe approval, private contacts and handover                               |
| FR-7.1–7.5   | Transactional lifecycle triggers, immutable audit, party-authorized timeline and edit audit                                                    |
| FR-8.1–8.5   | Staff/all-report access, reference administration/deactivation, scoring configuration and aggregate analytics                                  |
| T3.9, T3.12  | 50-way concurrency verification, unique-index backstop, rollback and audit reconstruction checks                                               |
| T4           | React 18/Vite routes, reusable forms/cards/states, draft persistence, responsive styling and browser journey                                   |

## Corrected backend contracts

The baseline controllers referenced nonexistent `sessions.sid/sess/expire`, `text_search`, and `audit_log.created_at`, called matching functions as procedures and lacked reverse matching/public views. They also accepted registration roles, used a default JWT secret, omitted authorization from claim decisions, dismissed matches to a nonexistent enum value and completed handovers without required timestamps.

The current application uses `sessions.session_id/user_id/expires_at`, `search_vector`, `changed_at`, and function calls. All schema changes are new numbered migrations. Session IDs store SHA-256 hashes of random refresh tokens. Each authenticated request rechecks the live session and current user role/active flag.

Database lifecycle triggers write creation and status transitions automatically. Profile/report/custody edits use the audit service. Both mechanisms use the same transaction and actor context. Reconstruction selects the last audit row with a non-null `new_status`; an ordinary `UPDATED` row does not replace the state projection.

## Database decisions

- The fixed score-to-band CHECK was replaced with a named database trigger checking the current `score_bands` ranges when a score/band is written. This permits configured thresholds while preserving historical match explanations after settings change.
- SQL expressions read all weights from `match_config`; the client displays `reason_json` without recomputing points.
- Reverse matching uses a found-item anchor in the same scorer, avoiding rescoring all other finds for every open loss.
- A pending-match partial unique index prevents duplicate active claims. Claim creation locks the found row, serializes the claimant quota with a transaction advisory lock, and locks/checks the owned lost report so withdrawal cannot race a new claim.
- Approval locks the found item first, checks verifier eligibility and authoritative availability, locks competing claims in ID order, then the lost row, and updates the matching rows. Competing rejection is systemic and never increments a user's flags.
- Rejection and handover acquire found then claim locks; handover locks the lost row before updating it. Timestamp CHECKs remain intact.
- Sensitive public listings remove exact location IDs as well as display names/descriptions. An observer cannot recover the fine location through the public reference dictionary.
- The synthetic seed no longer creates/drops a `ground_truth` table outside migrations. Ground-truth comparison uses a parameterized JSON recordset. All seed inserts now use the shared transaction helper and write the JSON file after commit.

## Verification evidence

The final command transcripts are saved separately in the delivery. The final API/database run contains 61 passing tests across two suites. Tests execute real SQL against a dedicated PostgreSQL database; the database is not mocked. The original twenty matching fixtures were also run against the repaired engine.

On the deterministic `--lost 200 --found 200 --seed 12345` evaluation dataset, all 60 planted pairs appeared in the top three and all 20 strong candidates were planted pairs. These are synthetic-data results, not a claim about real-world recovery or adversarial verification quality.

At 10,000 lost and 10,000 found records, the measured median of nine runs after a warmup was 4.21 ms on the local PostgreSQL 16 instance. The measured function invocation's EXPLAIN execution time was 4.158 ms. This is a warm-cache, single-anchor local measurement, not an end-to-end deployment latency guarantee.

Calendar DATE values remain ISO date strings rather than being coerced into instants; optional time windows can round-trip through editing. This prevents a date changing when a report is edited in a different time zone.

Browser verification exercised owner sign-in, the generated match, stored reasons, proof submission, finder verification, approval, contact disclosure, completed handover and the nine-entry timeline. Responsive checks cover 360, 768 and 1440 pixel widths; a discovered narrow-header overflow was repaired.

The privacy mutation intentionally caused the proof-visibility test to fail. The mutation runner verifies that this is the sole failed assertion and restores the query file before the normal suite runs.

## Boundaries of verification

- Docker Desktop was not running. Compose configuration is provided; no container build/start result is claimed.
- Local testing used Node 26/PostgreSQL 16. CI is configured for the required Node 20/PostgreSQL 15 combination; a remote CI result is not claimed until GitHub runs it.
- Human usability timing with five participants, formal screen-reader testing, twenty adversarial ownership trials, independent normalization review and a backup/restore rehearsal require separate human/release exercises. They have not been marked passed.
- The expiry command is implemented and tested, but a deployment operator must schedule it.
- Optional password reset delivery, SSO, notifications, report merging and claim reversal are not included in the MVP.
- Staff report collections currently return up to 100 recent reports per type; the public browse endpoint has explicit pagination. No bulk export interface is included.
