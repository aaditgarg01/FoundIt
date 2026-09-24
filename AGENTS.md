Never state that a command succeeded unless you ran it and are pasting its
real output. Paste output verbatim, including errors, warnings and noise.
Never summarise, elide, reconstruct or tidy terminal output. Never write
"..." inside a pasted transcript. If a command failed, say it failed and
paste the failure. If you did not run it, say you did not run it. An
unverified step reported as verified is worse than an unattempted step,
because it removes my ability to trust every other step.

# FoundIt — Agent Rules

Campus lost-and-found system. University DBMS course project.

**The full specification is in `docs/specs/` — six documents. They are
authoritative. Read them before changing anything non-trivial.**

| File | Covers |
|---|---|
| `01_FoundIt_PRD.txt` | Requirements, scoring rubric, business rules, syllabus mapping |
| `02_FoundIt_TRD.txt` | Schema DDL, normalisation, indexes, SQL, API |
| `03_FoundIt_App_Flow.txt` | Screens, flows, state machines, edge cases |
| `04_FoundIt_Design_Flow.txt` | Design tokens, components, wireframes |
| `05_FoundIt_Tech_Flow.txt` | Request lifecycle, transactions, query plans |
| `06_FoundIt_Implementation_Plan.txt` | Phases, task IDs, gates, descoping ladder |

---

## The one thing to understand

This is a **database project**, not a web app that stores rows. Matching,
concurrency, integrity and audit are the deliverables; the UI is packaging.

When choosing between an application-layer solution and a database-layer one,
choose the database. Logic that can live in SQL, in a constraint, in a view or
in a procedure belongs there.

---

## Hard constraints

### Schema
- **No manual schema changes.** If it is not in a numbered migration, it does
  not exist. Migrations are forward-only.
- **Read TRD §5 before editing schema.** Before editing any SQL or any statement
  about the schema, read the relevant DDL in TRD section 5 in full. Never infer
  a column name. If a column you need does not exist, say so and stop — do not
  invent one, and do not write prose that depends on one.
- **Every foreign key declares an explicit `ON DELETE`**, chosen per the policy
  table in TRD §7. `CASCADE` is correct for 3 of 14 keys and wrong for the rest.
- **Every constraint is named** per TRD Appendix C: `fk_` `uq_` `ck_` `ix_` `ux_`.
  Constraint names surface in error messages.
- Any rule expressible as a constraint **is** a constraint. Service-layer checks
  exist only to produce a friendlier message before the constraint fires.

### SQL
- **No ORM.** Hand-written parameterised SQL in `db/queries/`, one file per
  aggregate.
- **No string-concatenated SQL, ever.** Dynamic filters build a predicate array
  alongside a parameter array. Dynamic `ORDER BY` goes through an allow-list map —
  the user's string is a key, never a fragment.
- Authorisation is a **WHERE-clause predicate**, not an application-code
  comparison. `WHERE lost_id = $1 AND user_id = $2`, not fetch-then-compare.

### Transactions
- All multi-statement work goes through the `withTransaction` helper. No service
  opens a transaction by hand.
- **Global lock order — never deviate:**
  `found_items → claims → lost_items → matches → audit_log`
  Consistent ordering is what makes deadlock impossible by construction.
- In `approve_claim`, the **locking read comes first** and the status check reads
  the value obtained under the lock. Reading status before locking leaves the race
  window fully open while looking like a fix.
- Nothing slow inside a lock: no hashing, no HTTP calls, no template rendering.
- Audit writes happen **inside** the transaction they describe, via the audit
  service, which takes the client as a parameter.

### Matching engine
- Weights and thresholds come from `match_config`. Never hard-coded.
- The anchor predicate goes in the **WHERE clause**, not the join condition.
  In the `ON` clause the planner hashes the whole table — same result, 20× slower.
- Temporal scoring keys on `lost_date` / `found_date`, **never** `created_at`.
- `IS DISTINCT FROM` for the same-user check, not `<>` — `found_items.user_id`
  is nullable.
- Band comes from a join to `score_bands`, not a `CASE` expression.
- `reason_json` is stored with the match. The client renders it as-is and does
  no arithmetic.

### Privacy
- Public reads go through `v_public_found_items`. That view does not contain
  `private_feature`, `storage_location`, `user_id` or `finder_note` — so they
  cannot leak through it.
- Contact details are disclosed only after a claim reaches `APPROVED`.
- Return **404, not 403**, for another user's resource. 403 confirms it exists.
- Never log `password`, `token`, `authorization`, `proof_text`, `private_feature`.
  Redaction happens at the logger by field name, not at each call site.

---

## Definition of done

A task is done when **all six** hold:

1. Happy path works
2. At least one failure path handled with a comprehensible error
3. Any implied rule is a database constraint where expressible as one
4. An automated test covers success **and** failure
5. The relevant doc section is written or amended
6. Commit message names the requirement ID it satisfies (`FR-5.3`, `T2.6`, …)

Point 3 is the one most often skipped and the one that most distinguishes this
project.

---

## Verification standard

Never claim a step passed without showing output.

- "Migrations apply" → paste the migration run
- "Tests pass" → paste the test summary
- "It's fast" → paste `EXPLAIN (ANALYZE, BUFFERS)`
- "The lock works" → paste the concurrency test output

If a test passes suspiciously easily, break the implementation deliberately and
confirm the test fails before restoring it.

---

## Anti-patterns — reject on sight

| Anti-pattern | Why it's wrong |
|---|---|
| `location` as VARCHAR | Destroys matching, analytics and filtering at once. It's the transitive dependency the whole normalisation argument rests on. |
| Check-then-insert for email uniqueness | Classic race. Attempt the INSERT, catch 23505. |
| Uniform-random seed data | Makes every index look equally good; hides selectivity problems. |
| Recomputing the match score client-side | Guarantees divergence the first time a weight changes. |
| Status update without its timestamp | The biconditional CHECKs exist to catch this. Don't work around them. |
| Incrementing `flagged_count` on a systemic rejection | Punishes a user for losing a race they never entered. |
| `ON DELETE CASCADE` from `users` | Silently deletes a person's entire history. Anonymise, never delete. |
| Locking every row a join produces | Widens the lock footprint, creates deadlock opportunities. |
| Placeholder-as-label in forms | Label vanishes on typing; anyone interrupted mid-form is lost. |
| A bare "No results" empty state | Every empty state names a cause and offers an action. |

---

## Trigger ordering gotcha

PostgreSQL fires same-type triggers **in alphabetical order by name**.
`trg_claims_denormalise_found` must fire before `trg_no_self_claim`, because the
latter reads `NEW.found_id`. The current names sort correctly. **A rename breaks
this silently** — the comment in `005_matches_claims.sql` says so; keep it.

---

## Stack

PostgreSQL 15 · Node 20 + Express · `pg` · `node-pg-migrate` · bcrypt (cost 12)
· JWT · React 18 + Vite · plain CSS with custom properties · Jest + Supertest

Deliberately absent, and each for a stated reason in TRD §2.3: ORM, cache layer,
message queue, search engine, container orchestration.

    A biconditional constraint is correct only when the right-hand side is true
    for EXACTLY the values on the left and no others. Before writing one,
    enumerate every value of the enum and evaluate both sides for each. If any
    value makes the two sides disagree while representing a legitimate state,
    the constraint must be a one-way implication instead.
