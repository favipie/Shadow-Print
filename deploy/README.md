# SHADOWPRINT hosted demonstration

**Release state:** prepared for isolated staging. No hosted SQL instance, public FastAPI health URL, or Vercel deployment exists for this revision. The private repository's remaining free Actions allowance could not be confirmed. A local HTTPS rehearsal is available now.

## Demonstrate now for $0 on the existing Windows workstation

Use the repository's Python 3.12 virtual environment, Node.js, pnpm, Edge, OpenSSL (Git for Windows supplies it) and the local SQL Server test account described in [Windows setup](../SETUP-WINDOWS.md). From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm build
powershell -NoProfile -ExecutionPolicy RemoteSigned -File scripts/local-demo.ps1
```

Open the printed **localhost HTTPS** address. The script prints the path to a temporary local invitation file. Use its username and password on the sign-in page. The rehearsal creates its own one-day certificate and binds both services to loopback. Use a local demonstration browser profile for the temporary certificate. Do not install it as a system-wide trusted CA. No local SQL Server port is published.

1. At `/`, open Threat Monitor, select C-352, investigate its account and follow the network link.
2. Create a case with that evidence, add a note and reload the page. Open its report and export CSV.
3. Open `/?mode=workspace` to inspect the same SQL-backed case in the classic dashboard.
4. Sign out and reopen either URL to verify that it requires sign-in. Stop with Ctrl+C in the starting terminal, or run `powershell -NoProfile -ExecutionPolicy RemoteSigned -File scripts/local-demo.ps1 -Action Stop -Port <web-port>`. The supervisor closes both services and removes its invitation and disposable database. `-Action Status` lists the local URL, invitation path and certificate fingerprint without printing the password.

For an automated version, omit `--demo`. Playwright runs the production Next build and FastAPI over HTTPS against a newly seeded `shadowprint_test_<uuid>` database. The public client cannot supply the investigator identity. The baseline local application and the five existing browser workflows still use the original local policy.

## Hosting decision

The candidate is **Vercel Hobby + one x86-64 Linux VM running FastAPI and SQL Server 2025 Express in separate containers**. A private Docker network carries SQL traffic. Only Caddy publishes HTTP/HTTPS. This is a small, single-investigator-team demonstration with one API process and one shared synthetic workspace.

- The eligible personal, non-commercial frontend fits Vercel Hobby's free plan. The team inspected did not contain a SHADOWPRINT project. [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- Hetzner's published Germany/Finland CX33 price is **â‚¬0.0136/hour, capped at â‚¬8.49/month**, excluding public IPv4 and VAT. Backup storage, DNS and other extras are separate. This machine is a proposal, not an allocation. SQL Server Express has a free production license. The verified Microsoft container is Linux x86-64. [VM pricing](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/) Â· [Microsoft container support](https://learn.microsoft.com/en-us/sql/linux/quickstart-install-connect-docker?view=sql-server-ver17)
- OCI's always-free AMD micro offers 1 GB, below SQL Server's 2 GB Linux minimum. The larger free A1 instances use ARM. Azure SQL's free offer is a different database service, needs an eligible subscription and does not certify compatibility with this application's SQL Server 17 version guard. A private network and funded backup storage would still need verification. [OCI limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) Â· [SQL Server requirements](https://learn.microsoft.com/en-us/sql/linux/install-upgrade/setup?view=sql-server-ver17) Â· [Azure SQL free offer](https://learn.microsoft.com/en-us/azure/azure-sql/database/free-offer?view=azuresql)
- The user has no funded host and requires zero cost. Do not order a VM, add an account payment method, import the frontend into Vercel, or connect a public tunnel to the local Express instance. A sponsored compatible host with no charge to the user would remove the hosting blocker.

## Hosted authorization

All live records belong to **one shared synthetic workspace**. Invitations are unique per investigator. Viewers can read and export workspace records; investigators can also create/update cases, add notes and review comments; only admins can start detection runs. This model does not provide private per-user cases or separate tenants.

Hosted mode uses fixed HTTPS frontend/backend origins, exact Host/Origin checks on writes, a server-only service key and a second, revocable user session. The browser stores the opaque token in a Secure, HttpOnly, SameSite=Strict `__Host-shadowprint` cookie. Tokens are hashed in API memory, expire after one hour and are invalidated on logout, replacement login or API restart. Use one worker and one replica. Multi-replica hosting requires a shared session/rate-limit store.

The API checks roles before routing either API family. Original case, note and review audit rows use the authenticated actor. The verified detection procedure has no investigator column, so the API records the caller of detection runs in operational logs. Invite passwords are generated randomly and only salted scrypt hashes enter the API container. The process limits login attempts and total/per-user requests, bounds incoming bodies and disables raw access logs. Keep queries, case content, cookies, connection strings and keys out of external logs. Browser bundles include the project's authored synthetic fixture assets; persistent investigation records come only from the protected APIs.

## Future deployment on an authorized, no-charge host

These are **conditional operator steps**. Use a supported Linux x86-64 machine, Docker Engine with Compose, OpenSSL, Python 3 and a DNS name you control. Restrict the host firewall to HTTPS/HTTP for Caddy and restricted administrative access. Do not open 1433 or 8000. Review and pin all image versions for the release. The SQL image is pinned to the Microsoft manifest inspected for this branch. The Linux stack has not been booted on a hosted machine.

1. Require successful Actions **on the exact revision**, review the PR, and use that reviewed Git checkout. Choose distinct fixed domains for the frontend and API. Check DNS and TLS reachability. Keep the production frontend hostname reserved without triggering Git auto-deployments.
2. In the repo root run `sudo python3 deploy/prepare.py --api-domain api.example.org --app-origin https://shadowprint.example.org`, substituting the actual domains. This refuses existing settings. It creates server-only environment files, three distinct invitations, and a private CA plus TLS certificate for the database. Keep the encrypted host disk, root-owned `deploy/.private/` directory, CA key and backups restricted. Give each invited person only their own password over a private channel. Rotate/remove invitations by updating the protected membership file and restarting the API (which revokes sessions).
3. From `deploy/`, after accepting the Microsoft SQL license explicitly, run the following on the authorized host:

```sh
stack() { sudo env ACCEPT_SQL_EULA=Y docker compose --env-file .private/compose.env -f compose.yaml "$@"; }
stack up -d db
stack --profile maintenance build maintenance api
stack --profile maintenance run --rm maintenance bootstrap
stack --profile maintenance run --rm maintenance recovery
stack up -d api https
```

The installer accepts only the dedicated container hostname and fixed `shadowprint_demo` database. It validates script digests, acquires an installation lock, applies schema â†’ views â†’ procedures â†’ seed in one transaction, provisions limited runtime grants, registers the invited investigator IDs and records the manifest as a database extended property. Detection runs outside the installation transaction and can resume safely. Bootstrap refuses an unmarked nonempty database and an unknown manifest. Forward upgrades need a separate reviewed migration.

A recovery rehearsal creates a checksum-protected COPY_ONLY backup, actually restores a separate UUID-named database, checks counts, constraints, scores, detection procedures and rollback, and removes that restored copy. It retains the backup file on the SQL volume. **A host-local backup is not disaster recovery**: before any hosted release, take an encrypted, access-controlled off-host copy, retain its recovery keys separately, schedule backups for the agreed recovery point, and repeat restoration from that copy. Rotate the SQL TLS certificate before its 180-day expiry. Do not use the maintenance admin credentials for normal API traffic.

4. Confirm `https://<api-domain>/health/live` returns 200. A server-side request with the service key to `/health/ready` must return 200 after verifying the schema and invited investigator IDs. An unauthenticated API read must return 401. Test that SQL port 1433 and API port 8000 have no public listener. Confirm database TLS validates the certificate; keep `TrustServerCertificate=no`.
5. Only then link the personal repository to the intended Vercel project, with the Next.js app at repository root. Set `SHADOWPRINT_MODE`, `SHADOWPRINT_PUBLIC_ORIGIN`, `SHADOWPRINT_API_URL` and `SHADOWPRINT_API_KEY` from the **server-only** values in `.private/vercel.env`. Configure sensitive settings privately. Do not upload that file to Git or put values in `NEXT_PUBLIC_*`. Keep development, staging and production secrets separate. Git auto-deploy is disabled in `vercel.json`. Release the exact reviewed revision deliberately; do not import or publish an incomplete frontend.
6. Verify sign-in, denied calls, stale edits, actor audit rows, both dashboards, account/network navigation, threat review, coordination, case persistence, reports/CSV, mobile navigation and backend error recovery on the real URLs. Test revocation and restart. Run destructive tests only on separate disposable hosted data. Monitor readiness, aggregated 401/403/429/5xx, SQL pool saturation and backup failures. Use the previous compatible frontend/API revision for app rollback.

## Verification commands

```powershell
$env:SHADOWPRINT_RUN_DB_TESTS='1'
.venv/Scripts/python.exe -m pytest backend/tests -q
Remove-Item Env:SHADOWPRINT_RUN_DB_TESTS
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e
.venv/Scripts/python.exe backend/hosted_rehearsal.py
```

The backup rehearsal uses SQL Server's configured backup directory with only the newly created disposable database's filename. The original `shadowprint_db` is excluded. Remote CI on this branch should run after a repository owner confirms included Actions minutes or a hard zero paid-usage budget. A skipped workflow is not a passed check. Once that condition is met, a new ordinary commit on the branch triggers the repository's unchanged PR checks.
