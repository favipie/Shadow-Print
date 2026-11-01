# Normalization and design decisions

The operational model targets third normal form. Each account, post, comment, device and login is stored once. Accounts do not contain comma-separated device IDs: login events provide observed account/device associations. A post's author is not repeated on its comments; comment target is a separate semantic relationship and need not equal the post author.

**1NF:** repeating frontend arrays become junction rows. Case accounts, evidence and findings have composite primary keys. Labels are independent rows, allowing multiple annotations from different sources without adding columns. Original text is atomic content, not a comma-separated relationship.

**2NF:** junction tables contain only attributes dependent on the complete association. Account bios stay on accounts, case titles stay on investigations, rule thresholds stay on the rule's composite code/version key, and source license information stays on provenance.

**3NF:** derived chart totals, scores, graph device edges and current review state are views/queries rather than duplicated counters. Supplied labels and computed findings are distinct: source annotations do not become claims that detection was run. Evidence references an original comment, login or interaction instead of copying bodies/timestamps. A CHECK enforces one typed source, so there is no arbitrary entity-type/entity-ID pair without foreign-key integrity.

Source-record IDs plus provenance are alternate keys for accounts/comments. They preserve import lineage independently of local IDs. Cases link to findings and evidence through separate bridges. Notes link to a fictional investigator, not a monitored account; these entities have different roles. Review events are chronological records; the current state is selected with ROW_NUMBER and an ID tie-breaker. Audit JSON is a historical change snapshot, an intentional exception for variable before/after values; it does not store authoritative operational relationships.

Findings store the executed run and immutable rule version with the window anchor. Multiple qualifying windows are meaningful separate findings, while scores deduplicate rules per account. Rule descriptions and supplied source annotations stay in their own tables. The initial views use literal version-1 thresholds, so changing a rule requires a new SQL migration/version; there is no misleading promise of configurable backend rules yet.

Nine posts are explicitly invented scaffolding because the Phase 2 fixtures lack post IDs. The original comments are preserved exactly and mapped to a synthetic target-owned thread. This is an implementation assumption, not recovered source evidence. Original authored UI clusters and event summaries remain available in frontend fixtures; their computed equivalents are SQL findings, not duplicate persisted graph edges.

Foreign keys use restrictive deletion to avoid silently losing evidence. Production retention, legal holds, pseudonymization and immutable record enforcement need explicit later migrations. Audit capture currently covers the provided case-status/review procedures; unrestricted direct DML is not automatically audited. Database tests must run before integration, and indexes must be evaluated on the intended workload rather than assumed to prove performance.
