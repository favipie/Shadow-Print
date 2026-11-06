# Viva preparation

1. **What problem does the project solve?** It joins activity, supplied labels, explainable signals and human case decisions through traceable relational evidence. The dataset is synthetic; it is an academic workflow demonstration.
2. **Why SQL Server?** The implemented environment is local SQL Server Express with Windows Authentication. T-SQL views, procedures, constraints and transactions execute on the real engine. MySQL files are preserved reference material.
3. **What makes the schema normalized?** Entity attributes stay with their keys; repeating relationships use junction tables; provenance and rule metadata are stored separately; computed scores and totals are queried rather than maintained as duplicated counters.
4. **How are many-to-many relationships implemented?** Composite-key bridges connect cases to accounts/evidence/findings and findings to evidence. The combined key prevents duplicate associations.
5. **Why not store an arbitrary evidence type and ID?** A generic ID would lack referential integrity. Three nullable typed foreign keys plus an exact-one CHECK ensure every evidence row refers to one valid source.
6. **Why filtered unique indexes?** Each evidence source is optional. Filtering out NULL allows unrelated source types while requiring each actual comment/login/interaction reference to be unique.
7. **Are supplied labels detection results?** No. comment_labels records annotations with provenance; findings records a rule execution, account, anchor and run. Threat detection currently consumes a supplied label, not an NLP model.
8. **What is a sliding window?** For every anchor comment the query considers a time interval starting at that timestamp. BETWEEN includes both ends. The coordination test accepts 90 seconds and rejects 91 seconds.
9. **Why are there 11 findings but only some nonzero accounts?** Multiple anchors and rules can produce findings for one account. Scores deduplicate rule contributions per account instead of summing every window.
10. **Does a score represent probability?** No. It is a deterministic weighted review signal with no calibrated probability or validated accuracy claim.
11. **Does sharing a device imply shared identity?** No. Device links contribute zero points. A-007 and A-008 are benign shared-library controls.
12. **What distinguishes comments, annotations and evidence counts?** There are 28 original comments, 25 baseline annotation rows, 24 distinct detection-evidence comments and 53 finding-evidence associations. One comment may support multiple findings.
13. **How do transactions protect writes?** TRY/CATCH and XACT_ABORT roll back failed stored-procedure changes. API case/note transactions include audit rows; failure to write the audit rolls back the associated operation.
14. **Why use autocommit for procedure calls?** Those procedures start and own their transactions and reject nested caller transactions. Autocommit avoids SQLAlchemy implicitly wrapping them in a competing transaction.
15. **Are all case changes one atomic operation?** No. Metadata and status are separate audited operations. A partial failure is surfaced; the UI refreshes before retrying.
16. **How is latest review selected?** ROW_NUMBER partitions by comment and orders by timestamp descending with event ID as a deterministic tie-breaker.
17. **What does the recursive CTE prove?** It describes directed interaction reachability with a cycle guard and depth cap. It does not infer common ownership or identity.
18. **How is SQL injection reduced?** API values use bound parameters, input models validate shapes, and the browser never receives a database connection. Dynamic database identifiers are used only by guarded disposable-test tooling.
19. **Is the audit trail immutable?** It is append-oriented through application paths, but administrators/direct SQL can modify it. No tamper-proof or complete direct-DML audit is claimed.
20. **What is the current authentication model?** A fixed fictional local reviewer and Windows process identity for SQL. CORS and a request header are not user authentication. The app is kept on loopback.
21. **How was correctness tested?** Real SQL Server integration tests, fixture/constraint/boundary checks, API persistence/rollback tests, frontend provider tests and browser workflows. Modifying tests use owned disposable databases.
22. **Can you claim good performance on large data?** Not yet. The generator supports larger inputs, but passing a small workload is not a throughput benchmark. Normalization functions and self-joins need measured plans before making scale claims.
23. **What remains limited?** Bounded snapshots, local pagination, last-write-wins edits, no production authentication, no learned classifier and no statistical real-world evaluation.
24. **Why does a saved finding differ from a current score after direct source changes?** A finding preserves a past run; the score view evaluates current source rows. Rerun detection to align a new saved run. Normal application workflows do not edit source activity.

Practice answers using the actual schema and query files. If asked for an unmeasured metric, state that it was not measured rather than inventing a result.
