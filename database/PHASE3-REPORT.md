# Phase 3 delivery report

## Status

Database source implementation delivered. **Real-MySQL acceptance remains blocked by the environment.** No MySQL migration, seed insertion, detection procedure or SQL integration assertion is claimed to have run successfully on an engine. The working Phase 2 frontend is preserved and still uses its local fixtures/state.

## Delivered tables and relationships

| Tables | Purpose and relationships |
|---|---|
| provenance | Version, license, origin and synthetic/public/manual source classification |
| accounts, posts, comments | Source identities; account-authored posts and comments; separate comment targets; unique source-record mappings |
| devices, login_events | Pseudonymous device context and observed account/device usage |
| interactions | Like/share activity referring to posts and actors; no duplicated comment records |
| label_types, comment_labels | Multiple independently sourced annotations per comment |
| detection_rules, detection_runs, findings | Versioned thresholds/weights, actual executions, per-account/anchor findings |
| evidence, finding_evidence | Typed original-record references and many-to-many finding support |
| investigators, investigations | Distinct analyst identities and case status/decision metadata |
| investigation_accounts, investigation_evidence, investigation_findings | Normalized case associations |
| case_notes | Analyst-authored case notes with timestamps |
| review_actions, audit_history | Review event history and transactional case/review audit capture |

Total: **22 tables**. Primary/alternate/composite keys, restrictive foreign keys, CHECK constraints and time-based indexes are defined in `001_schema.sql`. The generated `ER.md` and `DATA-DICTIONARY.md` document relationships and complete field definitions. `NORMALIZATION.md` explains 1NF–3NF, justified historical snapshots, scaffold posts and source-versus-derived data.

## Executable SQL

`002_detection.sql` contains normalized-text and sliding-window views, explanation/evidence rows, distinct-rule scores, latest review state and three transactional procedures: `run_detection`, `review_comment`, `change_case_status`. Procedures roll back on SQL exceptions. Shared devices are excluded from all detection scores.

`004_academic_queries.sql` demonstrates JOINs, self-joins, GROUP BY/HAVING, correlated subqueries, CTEs, bounded/cycle-guarded recursive CTEs, ROW_NUMBER/LAG, views, EXPLAIN and a rollback transaction. `verify.mjs` exercises the procedures and constraints against real MySQL when configured.

## Seed results (generated files, not database row counts)

The exact demo seed was generated successfully from the original TypeScript fixtures: 9 accounts, 28 unchanged comments, 25 annotations, 6 devices, 8 logins, 3 cases and their associations. Nine posts are explicitly labeled synthetic relational scaffolding. Original library-device controls and potentially benign repeated reminders are preserved.

A larger workload was generated with N=10,000 and seed=42: **10,046 total comments**, comprising 28 originals, 10,000 harmless unique comments and 18 scenario comments. It adds 500 generated accounts (509 total). The ignored local `generated.sql` is reproducible with the documented command. No public dataset was imported; the schema supports explicit provenance for a future licensed import.

## Executed verification

- Existing frontend test suite: **16 passed, 0 failed**.
- Database artifact tests: **4 passed, 0 failed** (seed equality/original coverage, deterministic generator/counts, procedure parsing, safe SQL literal encoding).
- TypeScript check after database tests/docs were added: passed.
- Final production webpack build: passed (exit code 0), including TypeScript validation and static generation.
- Schema documentation generator: executed, documented 22 tables.
- Isolated mysql2 client: installed with a separate database lockfile; frontend dependencies and application source were not changed for backend integration.
- MySQL/Docker discovery: no executable/service found. `verify.mjs` without configuration correctly stopped before any SQL with the missing dedicated-schema message. This is a setup guard check, **not** a passing database test.
- Actual configured connection attempt: `MYSQL_DATABASE=shadowprint_demo node verify.mjs` reached the mysql2 connection attempt and failed with **ECONNREFUSED 127.0.0.1:3306**. No SQL or seed inserts executed. The migration/verification scripts also passed Node syntax checks.

## Outstanding work

Provision/configure a dedicated MySQL instance and execute migration plus integration suite, inspect generated-workload query plans, and fix any actual engine failures before declaring Phase 3 database acceptance complete. SQL has been source-reviewed and packaged but cannot be certified by artifact tests alone.

Later milestones remain unimplemented: FastAPI backend, frontend/API integration, end-to-end testing, final academic report, presentation and viva preparation. The next implementation sequence and prerequisites are documented in `CHECKPOINTS.md`. Unobstructed mobile visual QA and PDF/print verification remain pending from Phase 2. Direct-table audit bypass, authenticated actors and production grants need backend hardening.
