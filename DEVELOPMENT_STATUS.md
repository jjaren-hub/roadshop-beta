# EarnKeep beta development status

## Shared collapsible cards

Beta repository `jjaren-hub/roadshop-beta`. Implementation branch `feature/workspace-card-disclosures`. Integration branch `main`. Starting beta commit `06b3ba1`.

### Completed

- Audited the authenticated application pages, account tools, landing and legal pages, offline entry, and customer document surfaces.
- Added shared card headers and chevrons, independent per-workspace local preferences, keyboard operation, draft-preserving toggles and print rules. Retained the calendar and IFTA defaults.
- Integrated dynamic cards and repeated record identities across workspaces. Kept disclosure gates, required onboarding, navigation, ledger row editing and customer documents outside the card toggles.
- Updated the service worker precache. Added Chromium regression checks to the existing browser workflows.

### Tests and fixes

- Passed locally: release-static, finance, trucking, mechanic, insights, tax-planning, retention, reconciliation, quote-security, commercial and offline-vault suites.
- Passed in headless Chromium: service-worker redirect handling, offline navigation, authentication callbacks and cache isolation.
- During browser testing, an immediate refresh lost native disclosure changes. Fixed persistence by observing changes to the open attribute. The trucking workflow subsequently passed including the full → partial → cleared calendar cycle, draft retention, keyboard toggles and simultaneous open cards.
- Fixed the accessible name for generated Finance selects. Updated the backup deletion test to expand the newly collapsed section.

- The mechanic browser run reached PDF/print, logo recovery and business isolation. It then failed to locate the quick quote part-source selector by its exact label. Added its explicit accessible name and started a full rerun. Also kept primary mechanic creation shortcuts and the offline vault lock available on closed cards.

- Mobile mechanic passed, including actual part purchases, payment corrections, PDF/print, backup recovery and quote archive/restore. The repair-shop run exposed an existing out-of-scope variable in the split-entry UI. Moved the quick-entry explanatory note back to its owning editor. No accounting calculation changed. Re-running all profiles.

### Browser verification milestone

- All five local Chromium profiles passed after the editor fixes: lease-purchase trucking, mobile mechanic, repair shop, general contractor and other business. The suite exercises financial creation/editing, authentication with a fictional backend, fresh-tab persistence, business switching, backups, offline vault sync, printing and PDF download/sharing.
- A separate installed-app check passed with network access disabled and the new service worker controlling the page. Tested persisted card state after offline reload, both themes, reduced motion, and 320, 390 and 1280 px viewport widths. The harness supplies the offline OS indicator because local headless Chromium resets that signal during navigation.
- No outstanding application failures from those runs. Testing uses synthetic accounts and records.

### In progress and exact next steps

1. Run the complete browser suite with the additional installed-app check included and re-run automated suites on the final tree.
2. Merge beta PR #8 into beta main after those checks pass.
3. Compare the published service worker and its allowlisted assets against the merged release. Check the beta GitHub Actions browser run and record the outcome here.

Primary files are `cards.js`, `style.css`, `sw.js`, the workspace page scripts and HTML entry points, and `.github/qa/browser-auth-first.mjs`. Local reproduction follows `.github/workflows/prelaunch-qa.yml`. Supply a Chromium executable with `CHROMIUM_PATH`.

Published site: https://jjaren-hub.github.io/roadshop-beta/. Production deployment requires separate approval.
