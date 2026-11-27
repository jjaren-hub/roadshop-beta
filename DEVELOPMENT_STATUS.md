# EarnKeep beta development status

## Collapsible card upgrade — deployed and verified

Beta PR [#8](https://github.com/jjaren-hub/roadshop-beta/pull/8) merged into `jjaren-hub/roadshop-beta:main` at `6650bf88f70210ad2e83ff0490d4025213d22743`. Development started from `06b3ba1` on `feature/workspace-card-disclosures`. The implementation, regression fixes and offline/viewport tests are in `f8f288f`, `98ce6af` and `5ab8295`, respectively.

### Completed

- Integrated a shared disclosure component on business dashboard, trucking, mechanic, ledger, finance, quote, reporting, insights, tax, account, billing, support, backup and offline-entry pages. Preferences are local to the owner and workspace. Record-backed cards use stable identifiers where available.
- Added full-width keyboard-operable headers, chevrons, theme-aware styles, mobile touch targets, stacked form labels and independent expansion. Collapsing leaves form controls mounted. Current work and the Per Diem Calendar start open. IFTA and selected secondary sections start closed.
- Kept required setup and tax acknowledgment, navigation, critical notices and primary workflow shortcuts accessible. Customer-facing documents retain their print/PDF templates.
- Updated the service worker to precache the shared component. The published service worker and all 67 distinct precached files matched beta main byte for byte.

### Tests passed

- Local and hosted beta quality gates passed all 11 static and domain suites, the service-worker navigation suite and the five-profile browser suite. Profiles cover lease-purchase trucking, mobile mechanic, repair shop, general contractor and other business. [Hosted beta quality gate](https://github.com/jjaren-hub/roadshop-beta/actions/runs/46048274852)
- Exercised card taps and keyboard operation, simultaneous expansion, unsaved inputs, refresh, fresh-tab reopening, workspace isolation, full/partial/cleared per diem, financial record creation/editing, sign-in and business switching.
- Exercised backups and recovery, offline entry/merge, service-worker-controlled offline reload, 320/390/1280 px widths, light/dark themes, print layouts, and PDF download and sharing. Browser checks use Chromium and fictional accounts, providers and financial records. For the installed-app test, the transport is offline and the harness supplies the OS offline signal across navigations.

### Failures found and resolved

- Immediate refresh could precede the native disclosure toggle event. Persisting the open-attribute change fixed the calendar-state failure.
- Finance classification and quick-quote part-source selects lacked unambiguous accessible labels. Added explicit labels.
- A pre-existing quick-entry note in the split-line builder referenced variables outside that function. Moved the note to its owning editor. The split transaction save/edit tests passed.
- Adjusted the backup deletion test to expand the newly collapsed section before interacting with it.

### Current work, unresolved issues and next steps

The beta task is complete. No known unresolved regressions from this review. Verification covered Chromium with simulated device sizes and authentication. Physical-device Safari, Android WebView and live third-party sign-in were outside the executed tests.

Start future beta work from current beta `main`. Reproduce the verification using `.github/workflows/prelaunch-qa.yml`, including the browser suite in `.github/qa/browser-auth-first.mjs`. Use `CHROMIUM_PATH` for an existing Chromium installation. Production promotion requires a separate explicit instruction.

Implementation entry points are `cards.js`, `style.css`, `sw.js`, the HTML entry points and their corresponding workspace scripts. [Open the deployed beta](https://jjaren-hub.github.io/roadshop-beta/)
