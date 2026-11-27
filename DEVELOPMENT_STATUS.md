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

### In progress and next steps

1. Finish the five-profile Chromium workflow with fictional authentication and financial records. Check account switching, workspace-specific state, mobile/desktop themes, print and PDF projections.
2. Resolve any remaining failures. Re-run the affected suites and record results here.
3. Integrate into beta main and verify published assets at https://jjaren-hub.github.io/roadshop-beta/ against the merged commit.
4. Record deployment verification and remaining limitations here. Production deployment requires separate approval.

Primary files are `cards.js`, `style.css`, `sw.js`, the workspace page scripts and HTML entry points, and `.github/qa/browser-auth-first.mjs`. Local reproduction follows `.github/workflows/beta-qa.yml`. A Chromium executable can be supplied with `CHROMIUM_PATH`.

Known outstanding work at this checkpoint is completion of browser testing and live beta verification.
