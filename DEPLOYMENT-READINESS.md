# SHADOWPRINT production deployment plan

**Release decision: local academic use is supported. A public release requires the unchecked items below.** This is a design for a separate hosted environment. The local Express instance and its populated database stay on the investigator's PC. No cloud resources are needed to run the academic project.

## Proposed topology

| Component | Proposed host and boundary |
| --- | --- |
| Next.js | Vercel Node runtime for the frontend and the existing `/api/backend/*` route handler. Authenticated users access one HTTPS origin. The browser has no route to SQL Server. |
| FastAPI | A container on Azure Container Apps, integrated with a dedicated virtual network, serving the canonical ASGI entrypoint `main:app`. Package Python, unixODBC, Microsoft ODBC Driver 18 and the pinned backend dependencies. Expose an authenticated HTTPS API to the Next.js server. |
| Database | A **separate private SQL Server 2025 instance** on a VM in that network. Use compatibility level 170 and certify the exact server build in staging. Permit SQL connections only from the backend subnet and approved maintenance systems. Use private DNS, encrypted transport and certificate verification. |

This proposal keeps the engine family used by `app/db.py`, which checks the reported major version (17 or later). A managed Azure SQL Database alternative needs a separate capability test for that guard, the normalizer, procedures, indexes and all 22 tables. Hosting, licensing and cost require a later owner decision. [Container Apps networking](https://learn.microsoft.com/en-us/azure/container-apps/networking) · [SQL VM security](https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/security-considerations-best-practices?view=azuresql)

## Application and authentication gates

- [ ] Add an explicit hosted-mode policy alongside the existing local policy. Today the proxy requires loopback Host/Origin and a loopback HTTP upstream. Hosted mode should require an exact configured public HTTPS origin and exact HTTPS backend origin. Reject redirects, untrusted forwarded host headers, foreign origins, cross-site requests and disallowed paths/methods. Keep both API families under the existing proxy allowlist.
- [ ] Require an authenticated server-side user session before forwarding any request. Authorize case reads, reviews, edits, detection runs and exports. Validate object access for both API families. Require CSRF protection on writes. Carry verified investigator identity to FastAPI for audit attribution. The current shared key and fixed reviewer only identify the local application.
- [ ] Keep bearer authentication on both FastAPI API families and the additional compatibility write header. Configure the mounted legacy app's trusted hosts and origin checks for the backend hostname. Keep CORS disabled for browser-direct access unless an explicitly permitted browser consumer is introduced. Never rely on CORS for authorization.
- [ ] Set ingress body limits, rate limits and timeouts in front of FastAPI, including requests that bypass Next.js. Restrict docs/health detail by audience. Verify all error, CSV, printable HTML and cache-control behavior in staging.

## Environment and secret ownership

| Setting | Where to configure it | Requirement |
| --- | --- | --- |
| `SHADOWPRINT_API_URL` | Vercel server runtime | Exact allowlisted HTTPS upstream in hosted mode. |
| `SHADOWPRINT_API_KEY` | Vercel server runtime and backend secret store | Generate a new high-entropy key per environment. Coordinate rotation across both services and test rejection of the retired key. |
| `SHADOWPRINT_DATABASE_URL` | Backend secret store only | Use a dedicated least-privilege SQL principal or validated workload identity. Require encryption and certificate validation. Keep the local Windows-auth connection string out of hosted settings. |
| `SHADOWPRINT_INVESTIGATOR_ID` | Backend local mode | Replace fixed attribution with authenticated investigator mapping for hosted writes. |
| `SHADOWPRINT_CORS_ORIGINS` | Backend if needed | Explicit approved origins only. Align compatibility settings with the same hosted policy. |

Keep development, preview, staging and production credentials and datasets separate. Never place credentials in `NEXT_PUBLIC_*`, client bundles, logs, traces or source control. Preview builds should have their own synthetic data or run the explicit fixture interface. Verify environment changes with a new staged build. [Vercel environment variables](https://vercel.com/docs/environment-variables)

## Database release and recovery

1. Create a versioned migration manifest with checksums for the reviewed schema, views and procedures. Introduce a separate hosted installer with an explicit target check, schema-version ledger and migration lock. Existing local installers have target or ownership guards and are unsuitable for hosted upgrades. Keep application startup free of DDL.
2. For a new empty **staging** database, apply the reviewed scripts with a migration-only principal. Load synthetic seed data only when explicitly selecting a demo environment. Validate the catalog, trusted constraints, 9 accounts, 28 comments, 11 baseline findings, expected scores, evidence associations, inclusive boundaries and late-failure rollback. Exercise both API families.
3. For an existing hosted database, check its schema version, take and verify an encrypted backup, then apply only unapplied, reviewed migrations. Give the runtime principal the required reads, narrowly scoped workflow writes and procedure execution. Reserve DDL, backup and restore permissions for separate identities. Never run the empty-database seed over existing casework.
4. Agree recovery-point and recovery-time targets before release. Schedule encrypted full/differential/log backups appropriate to the recovery model, keep a separate protected copy and protect the recovery keys. Restore into an isolated instance and verify catalog integrity, audit history, scores and report retrieval. Record measured restore time before sign-off. [SQL Server backup on Azure VMs](https://learn.microsoft.com/en-us/azure/backup/backup-azure-sql-database)
5. Rehearse app rollback to the previous compatible build. Use forward-compatible schema changes across the release window. If recovery requires a database restore, quiesce writes, restore to a separate target, verify changes since the recovery point and deliberately switch the backend connection.

## Operations and release acceptance

- [ ] Add request IDs across proxy and API. Record route templates, status, duration, SQL pool timeouts and failure categories. Redact Authorization, connection strings, case notes, comment bodies and sensitive query parameters. Keep case audit history separate from operational logs.
- [ ] Use `/health/live` for process liveness and `/health/ready` for database/schema/investigator readiness. Alert on failed readiness, unexpected authentication failures, elevated 5xx rates, DB saturation and failed backups. Exercise restart and failover in staging.
- [ ] Run backend transaction tests against a staging-owned disposable SQL database and Playwright against a production-mode staging build. Recheck the paginated and classic dashboards, account → network → case navigation, persistent reviews, duplicate/stale writes, detection controls, CSV exports and print output. Include authorized and unauthorized users and cross-origin requests.
- [ ] Verify no service key appears in browser requests or static bundles, SQL has no public ingress, previews cannot reach production data and rollback has a tested owner. Review any Git-to-host auto-release settings before linking a deployment. Promote a reviewed staged build only after release authorization. [Vercel deployment checks](https://vercel.com/docs/deployment-checks)
