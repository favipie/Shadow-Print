> Historical source-branch report. Current merged-branch verification is recorded in [FINAL-INTEGRATION.md](FINAL-INTEGRATION.md).

> Historical checkpoint. The active application now uses Next.js -> FastAPI -> Microsoft SQL Server. This document preserves earlier work and its then-current limitations. See [current integration verification](INTEGRATION-VERIFICATION.md).

# Phase 2 validation — 1 November 2026

All seven Phase 2 screens are implemented in the existing frontend. This report distinguishes executed checks from remaining visual verification. No backend, database, authentication service or public deployment was added.

## Automated checks

All 16 automated tests passed (0 failures). The Node test suite covers fixture references, dashboard reconciliation, repeated-comment and coordination thresholds, the benign shared-device control, saved-state validation, case closure validation and CSV escaping/formula protection. Component interaction tests cover searching/filtering/reviewing/exporting comments, cross-screen links, analysis and unknown accounts, creating cases and saving notes, threshold persistence, report exports, dialog closure and case-insensitive account-ID search.

Final production webpack build completed successfully (exit code 0), including TypeScript validation and static page generation.

## Executed browser checks

- Desktop overview visually inspected at 1440 × 1000: original shell, typography, cards, chart and navigation retained.
- Account analysis executed, with rule score and original evidence displayed; account-to-network navigation retained the selected account ID.
- React Flow rendered the focal network. Zoom, fit view, edge selection and device-connection filtering were exercised. Selected account relationships exposed original C-410/C-411/C-412 evidence.
- Threat Monitor search for C-352 produced one record. Marking it reviewed and selecting Unreviewed removed it from the results; restoring All returned the record.
- Browser CSV download completed. The downloaded file was read and verified to contain the selected C-352 record, its account/target, source label, UTC timestamp and reviewed state.
- Mobile 390 × 844 inspection confirmed stacked cards and opening navigation. It exposed horizontal overflow from an absolutely positioned screen-reader label. The table wrapper now establishes its containing block; the closed mobile sidebar is hidden from focus/navigation.

## Consistency

The fixture contains 9 accounts and 28 original comments: 25 flagged examples and 3 benign controls. The default seven-day overview derives 22 comments/19 flagged examples from those records; fourteen days derives 28/25. Authored event groups are explicitly separate from comment counts. Cases reflect local statuses. Fixed authored labels and priorities are distinguished from threshold-based frontend findings. Shared devices alone contribute no risk score. These are fictional examples, not live monitoring or calibrated probabilities.

## Remaining verification limits

An unrelated browser extension injected a blank white iframe over the upper-right page, heavily obscuring the mobile view. It was not removed or disabled. Saved screenshots show that obstruction. Thus a clean, unobstructed visual pass across every screen is still pending.

After the preview server connection ended, browser automation blocked access to its generated connection-error page. The final mobile overflow fix could not be remeasured in the browser. Do not count the final mobile visual QA as passed. Application and component checks remain independently runnable locally.

The print layout is implemented, but a physical print or saved PDF was not verified. Local persistence is tested with browser-storage simulation; cross-tab synchronization is intentionally unsupported. Graph drag and pan are provided by React Flow but were not separately recorded as manual checks.

## Screenshots

- `qa/overview-desktop.jpg`: desktop overview, including the unrelated extension overlay.
- `qa/network-desktop.jpg`: rendered account network and evidence interface, including the extension overlay.

Start locally with `pnpm dev`, then open the address printed by Next.js. Run `pnpm test` and `pnpm build` to reproduce automated checks.
