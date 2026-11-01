# SHADOWPRINT

SQL-powered, synthetic investigation workspace for examining cyberbullying, spam and coordinated-harassment examples. It is an academic demo: its signals guide review and do not identify people, prove intent or make moderation decisions.

## Current state

Phase 1 dashboard and Phase 2 frontend are working. The project contains 9 synthetic accounts, 28 inspectable comments, explicit false-positive/benign controls and seven investigation screens. Phase 3 adds a MySQL reference database design and tooling, but neither live MySQL verification nor a SQL Server conversion has passed. The frontend remains local-fixture based until the FastAPI milestone.

See [PROJECT-STATUS.md](PROJECT-STATUS.md), [Windows setup](SETUP-WINDOWS.md), [database setup](DATABASE-SETUP.md) and the [Phase 3 report](database/PHASE3-REPORT.md).

## Repository structure

```text
src/                 Next.js frontend and synthetic demo fixtures
tests/               Frontend behavior and data-integrity tests
database/            MySQL reference schema, seeds, tests and academic material
database/sqlserver/  Planned, unimplemented SQL Server conversion
public/              Repository-owned public assets only
```

The user-supplied visual reference and local QA screenshots are intentionally ignored, so a clone uses a CSS-native hero visual.

## Stack

Next.js App Router, TypeScript, Tailwind CSS v4, Recharts, Radix UI, React Flow, and a separate MySQL 8 reference implementation. FastAPI and SQL Server support are future milestones.

## Phase 2 frontend

Phase 3 database source is now available in [database/README.md](database/README.md), with the [delivery and verification report](database/PHASE3-REPORT.md). It remains separate from the frontend. Real MySQL verification is blocked locally (connection refused); no FastAPI integration has been introduced.

A connected digital-safety investigation demo for the SQL/DBMS mini-project. All records are fictional. No FastAPI, MySQL, real authentication, NLP model, or live platform integration is connected.

## Start on Windows

Use Node.js 20.9+ and a package manager. The checked-in pnpm lockfile captures exact dependency versions.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:3000. With npm, use `npm install` then `npm run dev`; npm will resolve its own lockfile. The working QA preview may use port 3002.

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

Next.js uses webpack because the local Turbopack child-process bridge failed in this environment. No external font download is required.

## Connected screens

- Overview: comment counts derived from actual records; authored signal groups are labeled separately; chart, filters, review state, evidence dialog and CSV export.
- Account Investigator: searchable directory, original activity, devices, linked accounts, and an explicit frontend analysis action with evidence and weighted rule scores.
- Network Explorer: React Flow zoom, pan, draggable nodes, fit/reset controls, connection filtering, account focus and evidence inspection. The accessible connection list offers the same evidence without relying on graph interaction.
- Threat Monitor: text/account/ID search, category, provenance, date and review filters; original comment details; links to account, graph and cases; filtered CSV download.
- Coordination Analysis: a known coordinated scenario and a benign shared-device control; current-threshold evaluation; membership, timing and supporting records.
- Case Management: create/edit cases, attach accounts/comments/groups, add notes, record decisions, update all five statuses. Resolving/closing requires a decision. Local audit events record changes.
- Reports: selected-case scope, patterns, evidence/timeline, notes, decision, uncertainty, printable layout and CSV download.
- Settings: validated thresholds, data provenance, connection status, scoring explanation and local audit history.

Example flow: Threat Monitor → C-352 → Investigate account → Open network → connection evidence → Open comment → Add to case → Create or attach → Report.

## Data and consistency

`src/lib/investigation-data.ts` holds 9 fictional accounts, 28 original comments, 6 pseudonymous devices, 8 login records, 10 authored connections, 2 scenario groups and 3 seed cases.

The 28 comments include 25 flagged examples and 3 benign controls. At the default 7-day window, the overview shows 22 comments and 19 flagged examples; the 14-day window shows all 28 and 25. Six authored signal groups summarize those comments (five in the 7-day window). A group is not a comment count. The chart uses the same original comment records. Open cases reflect local case statuses across all dates.

Rule examples and supplied labels are distinguished throughout. Authored group priorities are fixed fixture metadata; account/report priorities are recomputed from the current frontend thresholds. The graph is an authored evidence reference and does not change when thresholds change.

All timestamps display UTC. Account associations, labels and device data are simulated. No public dataset was imported. The handshake image is user-supplied reference artwork with unverified redistribution rights; keep this as a local review project until rights are established or the asset is replaced.

## Architecture and persistence

- `src/app`: App Router root, metadata, responsive theme and print styles.
- `src/components/workspace.tsx`: preserved Phase 1 shell and overview.
- `src/components/screen-router.tsx`: lazy-loaded screens with loading states and hash-based deep links.
- `src/components/screens`: seven feature screens and shared evidence/form components.
- `src/components/demo-provider.tsx`: shared state, versioned browser storage, validation and audit trail.
- `src/lib/investigation-data.ts`: normalized ID-based synthetic fixtures.
- `src/lib/mock-data.ts`: authored event groups and derived chart aggregates.
- `src/lib/demo-engine.ts`: frontend rule evaluation, CSV escaping, route helpers and saved-state validation.
- `tests`: data integrity, analytical scenarios, negative controls, form validation and component interaction tests.

Cases, notes, reviews, thresholds and the latest 200 audit entries persist under `shadowprint.demo.v2` in this browser. Browser storage is not an encrypted database and does not synchronize across devices or concurrently open tabs. Corrupt/incompatible saved data is left untouched and the app shows a warning while using session-only state. Clearing site storage resets the demo.

## Phase boundary

Phase 2 is frontend-only. SQL schema, database migrations, seed generator at academic scale, analytical SQL, FastAPI, production auth and backend tests are deferred to Phase 3 onwards. Frontend scoring is a transparent demo heuristic, not a scientifically calibrated probability or an automatic moderation decision.

See `QA-REPORT.md` for executed checks, screenshots and remaining verification limits. Synced project files under `sources/` have not been changed.
