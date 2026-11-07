# API compatibility checkpoint

Implementation specification retained from reconciliation. Both contract families are now mounted; the tables below describe the compatibility obligations.

| Existing main `/api` | Recovery `/api/v1` | Required reconciliation |
|---|---|---|
| `GET /health` | `GET /health/live`, `/health/ready` outside version prefix | Preserve connection details and separate liveness/readiness. |
| `GET /workspace`, `/dashboard` | `GET /overview` plus individual collections | Compose the camelCase snapshot, preserving bounded consistent reads and distinct annotation/finding counts. |
| `GET /accounts`, `/accounts/{id}` | Same paths plus account logins/findings/related | Preserve search and pagination, convert recovery snake_case collections and expanded detail fields. |
| `GET /comments`, `/comments/{id}` | Same paths | Reconcile search, category/review/source/date filters, pagination, annotations and provenance. |
| `POST /comments/{id}/review` | `POST /comments/{id}/reviews` | Translate singular/plural paths, request fields, status code and review/audit transaction semantics. |
| `GET /network`, `/coordination`, `/evidence/{id}` | Same, plus coordination comment collection | Reconcile graph nodes/edges versus paginated login observations and preserve zero-score device controls. |
| `GET /findings`; `POST /detection/runs` | `/detection-runs`, run findings, finding detail/evidence | Preserve latest-run view and run history, caller/generated run IDs and evidence links. |
| `/cases`, `/cases/{id}`, `PATCH /cases/{id}/status`, `/cases/{id}/notes` | `/cases`, case detail and update, case notes | Reconcile camelCase versus snake_case input/output, validation, evidence associations, optimistic versioning and audited status updates. |
| `GET /reports/{id}?format=json,csv,html` | `GET /cases/{id}/report` | Retain JSON, safe CSV and printable HTML while supporting paginated recovery report data. |
| `GET /settings` | `/settings`, `/rules`, `/provenance`, `/audit` | Preserve read-only rule metadata and audit/provenance history. |

Implementation: canonical routes are in `app/api.py`, compatibility routes in `app/legacy/main.py`, sharing one engine/reviewer under the canonical bearer middleware. Both browser clients use `/api/backend/*`. Compatibility CSV/HTML/PATCH are allowlisted and retain upstream response headers. See README.md for the final contracts and ../FINAL-INTEGRATION.md for actual verification.
