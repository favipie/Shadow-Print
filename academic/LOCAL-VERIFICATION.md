# Local academic checkpoint — 6 November 2026

## Scope and changes

The user canceled Azure signup and all cloud deployment. Removed the uncommitted Vercel upload exclusions and deployment plan from that abandoned preparation. Corrected .env.example to use the implemented NEXT_PUBLIC_API_URL name and local origin. No hosted resource, subscription, public tunnel or paid service was created.

Added database/sqlserver/generate.py, a deterministic additive T-SQL workload generator with explicit synthetic provenance. It refuses non-disposable database names, existing transactions and a second workload insertion. Original schema, seed and MySQL implementation remain unchanged. Added two backend tests and a generator for the SQL Server field-level dictionary. Added academic report source, demo walkthrough and viva notes. No frontend runtime files changed in this checkpoint.

## Executed now

1. Read-only original database check from backend: `../.venv/Scripts/python.exe -m app.db`. Result: favipie\SQLEXPRESS, SQL Server 2025 Express 17.0.1000.7, shadowprint_db, 22 tables, 9 accounts, 28 comments, 25 labels, 11 findings and 3 investigations. Scores remain A-001=30, A-002=55, A-003=50, A-004=25, A-006=25; others zero. An initial invocation used the wrong relative Python path and failed before connecting; the corrected command above succeeded.
2. Set SHADOWPRINT_RUN_DB_TESTS=1 and ran `.venv/Scripts/python.exe -m pytest backend/tests -q` from the repository root: **13 passed**, one non-failing Starlette/HTTPX deprecation warning, 58.50 seconds. Tests created and removed their owned disposable SQL Server databases.
3. Ran `node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts tests/*.test.tsx database/tests/artifacts.test.ts database/sqlserver/artifacts.test.ts`: **26 passed, zero failures**, 21.68 seconds. Node was invoked through the existing installed executable because it was absent from the shell PATH.
4. Ran `.venv/Scripts/python.exe database/sqlserver/document_schema.py`: **22 SQL Server tables documented** from actual DDL.

## Generated workload experiment

Inputs: 30 harmless comments, LCG seed 42, plus 18 scenario comments. A newly created disposable database started with the original seed and 11 baseline findings. After the additive script:

| Measurement | Result |
|---|---:|
| Accounts | 21 |
| Comments | 76 |
| Annotation rows | 43 |
| Findings in workload-verification run | 20 |
| Generated REP account SG-000000 | 25 points |
| Generated TARGET account SG-000001 | 25 points |
| Generated THREAT account SG-000002 | 20 points |
| Generated coordinated accounts SG-000003/4/5 | 30 points each |
| Other generated accounts, including shared-device controls SG-000006/7 | 0 points |

The 20 findings belong to the new run; the original baseline run's 11 findings remain historical records. Comparing source comment rows confirmed the original 28 were unchanged, and comparing scores confirmed the original nine scores were unchanged. Coordination at 90 seconds matched; shifting the last participant to 91 seconds removed that generated window and the change was rolled back. Reapplying the workload raised an error, left counts unchanged and left @@TRANCOUNT at zero.

Generator determinism, seed variation, SQL quote escaping and invalid-argument rejection passed. This is a correctness experiment, not a scalability benchmark. The generator's upper input bound of 100,000 harmless comments has not been performance-tested; current normalization/self-joins may be expensive at that size.

## Prior verification retained

The production webpack build, three full browser tests, desktop/mobile visual inspection and printable PDF verification passed during Phase 4–5. They were not rerun for this documentation/generator-only checkpoint. See ../backend/PHASE45-REPORT.md for executed evidence. Existing full frontend integration remains intact.

## Remaining academic work

The report and viva material are editable Markdown sources. Final institution-specific cover/declaration/citation formatting, rendered DOCX/PDF, presentation slides and measured execution-plan/performance evaluation remain pending. No fabricated accuracy or benchmark values are included.
