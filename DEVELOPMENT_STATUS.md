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


## Subsequent beta work — November 27, 2026 (not yet fully browser-verified)

- Manual-entry simplification removed settlement, receipt, bank CSV, tax and mechanic photo upload controls; business logo and recovery retained.
- Trucks simplified to compact tap-to-edit list, description/VIN, starting and current odometer. Fuel entry posts separate diesel/DEF expenses tied to truck/load; purchase MPG and weighted fleet MPG feed dashboard and 30-day load estimates. Optional load comments added.
- Finance initialization syntax error fixed at `33fe850`; subsequent syntax checks passed for eight affected modules. Sample fuel, weighted MPG and rolling fuel estimate calculations passed. Current complete browser/hosted gate still needs verification.
- EIA weekly national on-highway diesel benchmark: seed week 2026-11-23 ($5.695/gal; prior $5.937), source EIA historical series EMD_EPD2D_PTE_NUS_DPG. Dashboard uses a public read-only JSON feed, last valid local cache, explicit observation date and stale/unavailable notices. `.github/workflows/eia-diesel.yml` checks Tuesday and Wednesday at 14:25, 15:25 and 17:25 UTC (covers 10:25 a.m. Eastern in both daylight and standard time); `.github/scripts/update-eia-diesel.py` validates dates and values before publishing. GitHub raw feed avoids dependence on Pages rebuilds from workflow commits. No private financial data is sent. Workflow execution and real browser/network verification remain pending; production unchanged.
- Next: verify scheduled EIA workflow and feed, run full beta regression including Add Fuel and load lifecycle; complete trucking review and obtain explicit approval before production promotion. If production is promoted, review public feed URL/CSP and preserve a single authoritative feed.

### Empty-mile compensation
- Business Settings operating rates include optional empty-mile pay (default zero). New loads inherit it, existing loads retain their recorded rate or zero. Load revenue and payment include a separate Empty mile pay category and unique ledger identifier. Settlement suggestions, planning forecast and profitability calculator include empty-mile compensation; FSC remains loaded-mile only. No changes to existing paid ledger records.
- New domain assertions passed for paid/zero/missing empty-mile rates, payment posting and calculator totals. Syntax checks passed for edited scripts. Full browser and hosted deployment verification pending. Latest cache: `roadshop-earnkeep-empty-mile-pay-20261127-1`.


### One-button load lifecycle — November 27, 2026
- Completed on beta `main`: load list cards now offer a single next-action button (Mark picked up → Mark delivered → Mark paid), with a read-only Payment recorded indicator after payment. Open/View load remains available. Pickup/delivery use existing load validation and atomic local save; stage filter remains active. Paid shortcut opens a focused payment review using the same payment date, settlement matching, confirmation and atomic ledger posting as the full editor. Future actual dates are rejected; edit the recorded dates first if needed. Revenue is not posted until payment, and existing paid records are locked.
- Relevant files: `trucking.js` (69ce3b1), `.github/qa/browser-auth-first.mjs` (a91b576), `sw.js` (cache `roadshop-earnkeep-load-stage-action-20261127-1`). Updated browser fixture exercises both quick stage transitions, persisted status, canceled payment, successful receipt and ledger totals. `trucking.js` parsed successfully with the JavaScript engine. Hosted browser and service-worker regression results are pending; no claim of a verified deployment or test pass. Earlier unresolved beta tasks above remain open.
- Next: verify the latest hosted beta quality gate and published bytes, test the shortcut on mobile and with matching settlement entries; fix any failures before production promotion. Production unchanged.

### Early pickup/delivery shortcut fix — November 27, 2026
- Driver reported pickup worked but delivery did not advance when scheduled for the next day. Root cause: the existing domain validation disallows future actual pickup/delivery dates. The shortcut now asks for confirmation before replacing a future scheduled date with the device's current local date, and then uses the original validation and save path. Cancellation makes no changes; no ledger income is posted by pickup/delivery. The full editor remains unchanged.
- `trucking.js` (175f6c1), browser regression fixture (c4d1ae9) covering canceled and confirmed early delivery, `sw.js` cache `roadshop-earnkeep-early-load-status-20261127-1`. JavaScript parsing checks passed for edited application and service-worker scripts. Browser regression execution and deployed-byte verification pending. Production unchanged.
- Next: verify beta on the driver's existing load and the hosted quality gate, then resolve any regressions before production promotion.

### Visible ledger correction controls — November 27, 2026
- Finance ledger cards now expose a Delete entry action for eligible unlinked, active records, including diesel and DEF fuel purchases; ordinary transactions retain Edit, and projected quote payments expose Manage payment. The action uses the existing original-date accounting offset after confirmation, preserves the audit trail and leaves linked transactions protected. Corrected originals and reversal rows are explicitly labeled and cannot be corrected again. Fuel items from a shared stop can be removed independently. Current odometer, active fuel totals, load fuel totals and fuel averages exclude reversed rows through existing domain logic; historical later purchase MPG baselines are not retroactively rebuilt. Correct a fuel mistake by removing the incorrect item and recording the replacement, subject to the existing chronological entry validation.
- Files: `finance.js` (3e7c7de), `.github/qa/browser-auth-first.mjs` (91d47b1), `sw.js` (cache `roadshop-earnkeep-ledger-delete-20261127-1`). JavaScript syntax passed for edited app and worker. Added browser assertions for canceling deletion, correcting one fuel product while retaining the other, linked load costs, prevention of repeat correction and odometer returning to starting miles after both are reversed. Browser execution and published deployment verification pending. Production unchanged.
- Next: run beta hosted quality gate, verify mobile ledger and corrected fuel records; evaluate historical MPG baseline rebuilding if needed before promotion.

### Permanent mistaken entry deletion — November 27, 2026
- Supersedes the previous ledger correction behavior: Delete entry now permanently removes eligible unlinked mistaken records in both finance and classic ledgers, without a reversal. Existing explicitly marked same-date mistake correction pairs can be permanently removed together after confirmation; actual reversals and linked records remain protected. Existing pairs are not automatically deleted. Fuel products remain independently removable; active expenses, current mileage and MPG aggregation update from remaining rows, but later stored MPG baselines are not rebuilt. Existing external backups are unaffected.
- Files: `core/finance.js` (cc69f75), `finance.js` (7e374e4), `app.js` (18bab4f), browser regression (50aa383), domain regression (0f0dd3a), `sw.js` cache `roadshop-earnkeep-permanent-ledger-delete-20261127-1`. JavaScript syntax and inline domain checks passed for standalone deletion, pair cleanup, and protected actual reversals and linked originals. Added persistent regression cases and updated browser expectations. Full hosted QA and deployment verification pending. Production unchanged.
- Next: verify beta published bytes and hosted quality gate; confirm deletion and legacy pair cleanup on mobile before production promotion.

### Proposed Google Drive backup privacy policy — November 27, 2026
- Added `privacy-google-drive-draft.html` (91c33e8), a full proposed policy for attorney review, explicitly not in effect and noindexed. Existing beta and production policies unchanged. Draft specifies separate opt-in `drive.file` authorization, local encryption and password control, direct browser-to-Google transfer, no EarnKeep server copies or credentials, Limited Use disclosure, disconnection and backup retention/deletion controls. Reviewed Google API Services User Data Policy and Drive scope guidance. Existing 25 sections preserved; draft markers and key disclosures verified in repository. Not a legal sign-off or verification of an implemented feature.
- Next: attorney review; design and implement Drive backup/recovery with least privilege, client-side encryption, no server storage of Drive credentials or backup contents; verify Google consent/verification obligations and live behavior; review Terms and marketing for consistency; approve effective date and publish before enabling. Google Drive feature not implemented or enabled. Production unchanged.
