# EarnKeep final QA and production release

## Baseline and scope

- Beta `main`: `ce11637976fd21bce9088de25f1d3ed39c9ae006` ([commit](https://github.com/jjaren-hub/roadshop-beta/commit/ce11637976fd21bce9088de25f1d3ed39c9ae006)).
- Production `main`: `210fa5fecc9f278a4ff9044037e887e9ca052c41` ([commit](https://github.com/jjaren-hub/RoadShop/commit/210fa5fecc9f278a4ff9044037e887e9ca052c41)). Its relationship to the live build is pending verification.
- Recovery branch: `release/earnkeep-final-qa` in the beta repository. Keep this root file on the recovery branch so it stays outside deployed site files. Update the file after each checkpoint. Recover its newest entry before changing code.
- Objective: Review and repair trucking, financial accuracy, mechanic tools, authentication, workspace isolation, storage, backup, offline behavior and PWA updates. Verify the exact published beta candidate, preserve production configuration and customer data, and promote only after all release gates pass. Use fictional fixtures for any write tests.

## Checkpoint 1 · 2026-11-27 · Baseline pinned

- Completed: Verified repository heads. Checked beta `main` and the existing `qa/production-release` branch for this log. Initialized this recovery branch from beta `main`.
- Current phase: Inventory and baseline QA. Files modified: `RELEASE_PROGRESS.md` only. The initialization commit is the first commit on this recovery branch.
- Tests and assertion counts: 0 tests executed, 0 assertions observed. Workflows: pending inventory. Defects and fixes: pending review.
- Pending: Complete trucking, mileage and cross-application QA, including defensive isolation checks, published asset matching and mobile/desktop browser flows. Record defects, fixes, commit SHAs and test results. Compare production, pin the approved beta commit, prepare rollback, promote and verify production.
- Deployment: Approval pending. Production untouched. Beta and production deployment identity and run IDs pending verification.
- Rollback: Before promotion, confirm the previously verified Cloudflare production deployment and record its deployment identifier and production SHA. If a critical post-deployment gate fails, restore that deployment and revert the promotion on production `main` to keep source and deployment aligned. Verify the live asset set afterwards.
- **Exact next action:** Fetch beta `main` and review `.github/workflows`, `.github/qa`, deployment inputs, and production access. Execute the existing baseline suites and record each result with the exact tested SHA.

## Checkpoint 2 · Baseline static suites

- Tested beta `ce11637976fd21bce9088de25f1d3ed39c9ae006`. All 11 suites in the static workflow step exited 0: release-static, finance, trucking, mechanic, insights, tax-planning, retention, reconciliation, quote-security, commercial and offline-vault. The suites reported 221 explicitly counted assertions and 67 precache assets checked. Other suites and appended regression cases do not print counts. Finance exited successfully with no summary.
- Inventory: `.github/workflows/prelaunch-qa.yml` runs static, Cloudflare-style service-worker navigation, beta byte verification and the published browser suite. `.github/workflows/production-verify.yml` runs production byte/header checks and a browser suite. Both site roots returned HTTP 200. Initial local invocation of beta byte verification lacked the required URL environment variable and exited 1 before checking any assets.
- Access: Public beta checkout works. The production git remote requires authentication unavailable to the terminal. GitHub connector reads both repositories and has written the beta recovery branch. CLI access to private production is still to be resolved or replaced through the connector.
- Files modified: recovery log only. Log initialization commit `a7a56cbd58410cd6b53938c04a75e4550e165e1e`. No application defects confirmed at this checkpoint.
- **Exact next action:** Run published beta bytes with `EARNKEEP_TEST_URL=https://jjaren-hub.github.io/roadshop-beta/`, run browser and service-worker tests, inspect trucking logic and open findings, and obtain Actions run links.

## Checkpoint 3 · Published baseline identity and CI failure

- The beta byte verifier passed against `ce11637976fd21bce9088de25f1d3ed39c9ae006` and matched 68 published assets. The matching [Pages run 46099126915](https://github.com/jjaren-hub/roadshop-beta/actions/runs/46099126915) succeeded.
- The same commit's [beta QA run 46099127156](https://github.com/jjaren-hub/roadshop-beta/actions/runs/46099127156) failed. The stage and reason are under investigation. Production remains gated.
- Local Playwright package installed. The three initial browser invocations exited before loading a page because the system Chromium wrapper points to a missing binary. Started installation of the pinned Playwright browser. No browser assertions credited.
- **Exact next action:** Read the failed job steps and logs. Run the pinned browser with the replacement binary, reproduce any application failures with fictional fixtures and record them before editing.

## Checkpoint 4 · Browser regression triage

- [QA job 140837314508](https://github.com/jjaren-hub/roadshop-beta/actions/runs/46099127156/job/140837314508) passed the static step, service-worker browser step and deployed byte step. The published UI browser suite stopped at `.github/qa/browser-auth-first.mjs:215`, with a raw ledger length of 1 and an expected length of 3.
- Candidate defect QA-01: The reconciliation test uses a fixed total row count instead of testing whether close/reopen preserves the ledger. Investigate the fixture timeline and assert actual before/after ledger contents while keeping matching and history assertions.
- Playwright CDN returned HTTP 403. Installing a temporary Chromium distribution from the npm registry to continue independent browser verification.
- Production `sw.js` is readable at the pinned commit, with cache identifier `roadshop-earnkeep-domain-release-20261127-6`. The existing beta copy of the production workflow was not found on production `main` at the same path, so inspect production workflow inventory before dispatch.
- **Exact next action:** Repair the reconciliation fixture and run through the next browser gate. Continue auditing mileage and transaction edge cases while browser setup completes.

## Checkpoint 5 · Accounting defects identified before edits

- QA-01: Earlier fixture steps permanently delete the test supplies and classic-ledger expense. The store correctly contains the remaining rent expense. The reconciliation assertion should check the existing rent and compare the full ledger before and after reconciliation. A local test edit is staged for execution, with the previous match and audit history assertions retained.
- TRK-01: `payLoad` accepts an existing unassigned ledger row as the matching payment but leaves the row unassigned. A paid load then contributes its miles while its revenue disappears from that truck's report. Reproduce with a fictional unassigned payment, then assign the row to its truck when linking and preserve its ID and amount.
- TRK-02: Settlement posting classifies escrow lines and reconciles the statement but skips recorded escrow balance checks for releases. This permits a negative truck balance through settlement posting even though the dedicated maintenance flow rejects it. Validate the projected ledger as a whole so same-statement contributions count and combined withdrawals cannot overdraw.
- The temporary Chromium binary is available. Independent local and published browser runs and the service-worker run are in progress. No beta or production application commit has been published in this review yet.
- **Exact next action:** Add failing cases for TRK-01 and TRK-02, implement the targeted changes with regression coverage, then finish the browser regression and publish the vetted candidate to beta.

## Checkpoint 6 · Targeted fixes and second browser fixture failure

- Local changes in `core/trucking.js`, `sw.js`, `.github/qa/trucking.mjs`, and `.github/qa/browser-auth-first.mjs`. TRK-01 failed in a new local regression before the fix. The targeted trucking suite now passes, including 4 new load-assignment checks and 6 new settlement escrow checks. The cache key changed to refresh the shipped trucking logic.
- QA-01 passed in a local Chromium run, which advanced to a second fixture defect, QA-02. The per diem calendar and legacy travel form share a deductible-percentage label. The browser selector now identifies the calendar's numeric field specifically and retains all four calendar state checks.
- Local service-worker browser suite passed. Independent published browser launch reached a network error before the first page; direct Node asset verification had already passed. Use the GitHub published-browser runner and try the workspace proxy explicitly for independent reproduction.
- **Exact next action:** Confirm browser results after QA-02, review compatibility for previously linked unassigned payments, commit the build and start a fresh published beta gate.

## Checkpoint 7 · First complete browser pass and legacy compatibility

- The independent browser suite passed on a local checkout with fictional intercepted auth and finance fixtures after QA-01 and QA-02. It completed all 5 occupation scenarios at 320/390/1280-pixel layouts, including mechanic logo/PDF, encrypted backup, install-style offline reload, and Google-style PKCE redirects. This run preceded the legacy report compatibility edit and is local evidence only.
- TRK-01 now resolves legacy paid loads by their saved ledger links in reporting, without rewriting saved rows. The targeted trucking suite passed after the change with 6 load-assignment and 6 escrow assertions in addition to existing checks.
- **Exact next action:** Extend the browser gate with the requested 1,208 versus 1,250 mile example and the posting flows that lack end-to-end coverage. Then commit the candidate and run on the published beta.

## Checkpoint 8 · Expanded browser evidence and calculator precision finding

- Expanded local browser scenarios exercised the required mileage example through the UI and verified 1,208 paid miles, 1,250 recorded miles, $2,416.00 revenue, $1.93 per actual mile, $0.34 cost per actual mile, planned miles excluded, and truck isolation. The same run passed manual submission through cent reconciliation, PDF/JPEG/PNG acceptance and ledger settlement checks. Early attempts stopped on selectors for the new fixtures; the next complete results are pending.
- All 11 static suites and the EIA parser fixtures passed on the working changes. The static suites report 233 counted assertions, with additional uncounted checks. This run predates the next calculator precision check.
- TRK-03 found during source review: The calculator rounds linehaul plus fuel surcharge together while saved loads and ledger posting round the separate components. With fractional-cent mile rates, the same fixture can differ by one cent. Use the same component rounding for the calculator and add an exact fixture before re-running.
- Production read-only inventory: `earnkeep.app` serves the pinned production `sw.js`, `trucking.js`, `account.html`, support, privacy, and terms blobs. The two new beta assets return the production SPA fallback today. Production has its own Cloudflare `_headers`, canonical `/account` redirects, and materially different legal documents. Beta and production use identical committed client authentication configuration. Preserve those production-specific files and compare the final candidate by path.
- **Exact next action:** Add the calculator rounding regression and installed cache-update check, run all local suites, commit the verified beta candidate, then monitor the published GitHub Pages and quality gate runs.

## Checkpoint 9 · Beta candidate committed

- Candidate [`76318741087120dac93d9333763fa7292920fc9a`](https://github.com/jjaren-hub/roadshop-beta/commit/76318741087120dac93d9333763fa7292920fc9a) based on `ce11637976fd21bce9088de25f1d3ed39c9ae006`. Its remote tree exactly matches the local candidate tree `6f01c129644c96889cee30be331e2c986d196567`.
- Files: `core/trucking.js`, `sw.js`, `.github/qa/trucking.mjs`, `.github/qa/browser-auth-first.mjs`, `.github/qa/sw-navigation.mjs`, and `.github/qa/verify-deployment.mjs`.
- TRK-03 reproduced in the new regression and passed after using separate revenue component rounding. All targeted trucking checks passed with 13 new counted assertions. The browser suite passed all 5 occupation flows plus the newly added mileage, settlement, maintenance, IFTA, lease, and flat-rate calculator cases. Service-worker browser tests passed, including update activation, cleanup of the older cache, and offline navigation on the replacement cache.
- Approval pending the published run on the committed SHA. Production remains at the initial baseline. Application files include no recovery log or new customer-facing support material.
- **Exact next action:** Fast-forward beta `main` from its pinned head to this candidate, then retrieve the Pages deployment and QA run IDs and verify the actual published bytes and browser results.

## Checkpoint 10 · Beta deployment started

- Beta `main` moved from `ce11637976fd21bce9088de25f1d3ed39c9ae006` to `76318741087120dac93d9333763fa7292920fc9a`. A fresh fetch matched the tested tree byte-for-byte.
- [Pages deployment 46100767447](https://github.com/jjaren-hub/roadshop-beta/actions/runs/46100767447) and [beta QA 46100767991](https://github.com/jjaren-hub/roadshop-beta/actions/runs/46100767991) started on that exact SHA.
- Post-commit static recheck passed all 11 suites and the EIA parser. The suites report 234 counted assertions with additional checks reported by suite or scenario.
- **Exact next action:** Wait for both beta runs. Verify all 69 published assets and obtain the actual published browser log. Establish the production rollback baseline using the deployed asset hashes and protected files.

## Checkpoint 11 · Published assets matched and second-run browser timing issue

- [Pages deployment 46100767447](https://github.com/jjaren-hub/roadshop-beta/actions/runs/46100767447) completed successfully. The official byte step and a separate local run verified 69 hashes against the candidate. The official service-worker step passed.
- Independent Chromium through the workspace network trust store reached the published site. An actual beta Google sign-in initiation sent the canonical beta callback with PKCE and returned a redirect from the real auth server to Google. The full exchange uses fictional interception.
- QA-03: The independent published browser stopped at line 91 with a count of 0 immediately after the ledger heading appeared, before checking that business navigation had mounted. Require the navigation to appear and still assert all four trucking links in order. If navigation remains absent, treat that as an app defect.
- Verified the rollback baseline against live production: 67 asset hashes match `210fa5fecc9f278a4ff9044037e887e9ca052c41`, and production headers and the query-preserving `account.html` redirect passed. Production promotion remains gated.
- **Exact next action:** Resolve QA-03 in the browser test and rerun independent published Chromium. Read the first candidate's official browser result. Commit the verified fixture adjustment and wait for the updated official gate before promotion.

## Checkpoint 12 · Official beta passed and production CSP conflict found

- [Beta QA 46100767991](https://github.com/jjaren-hub/roadshop-beta/actions/runs/46100767991) completed successfully on `76318741087120dac93d9333763fa7292920fc9a`, including the published browser step. A local Chromium run also passed the navigation wait and added console/network checks.
- The independent browser rerun passed the navigation check but its separate Playwright HTTP request went around the workspace proxy and failed at DNS. This affected independent backup fixture setup only. The GitHub runner's full published test passed.
- TRK-04 found during production comparison: The beta trucking dashboard retrieves the diesel benchmark from `raw.githubusercontent.com`. The production Cloudflare CSP intentionally blocks that host. Use the same-origin published feed, trim the extra beta CSP entry, verify the request in the browser, and preserve the existing production headers and scheduled refresh behavior.
- Production's current real Google sign-in initiation passed the canonical callback and provider redirect check. No real account was used.
- **Exact next action:** Fix the same-origin benchmark, run local and published beta verification on a new candidate, and prepare the production asset manifest and data-refresh configuration after its gates pass.

## Checkpoint 13 · Production artifact exposure and rollback deployment identified

- PROD-01: Production builds the repository root. A direct request served the currently tracked production QA script as JavaScript. The full pinned production tree contains 15 QA scripts, `DEVELOPMENT_LOG.md` and a release-oriented `README.md` alongside the application. They are outside the application surface and remain recoverable from the pinned commit. Exclude them from the promotion tree and verify their former URLs cannot serve their original bytes.
- Production rollback deployment: Cloudflare Pages `c058838b-0fd9-421f-8674-919bf804564a` for `210fa5fecc9f278a4ff9044037e887e9ca052c41`, [GitHub check 140642529972](https://github.com/jjaren-hub/RoadShop/runs/140642529972). Git tree `02bb3c954abf26f38821405adbf52fdbb9d3b5df`. If rollback is needed, restore that deployment and put the previous source tree on `main` in a new, non-rewriting revert commit. Verify all 67 baseline hashes after rollback.
- TRK-04 working changes make the dashboard fetch its published same-origin JSON and remove the now-unused external CSP entry. Browser coverage checks a valid HTTP response and rendered observation. The cache version changes for installed users. The production HTTP security headers, Supabase files, Cloudflare project settings, and domain should retain their pinned configuration.
- The weekly benchmark refresh is part of the existing beta feature. The production candidate needs the same refresh cadence for its local JSON and must keep operational source out of the customer-facing routes. Run the QA suites from beta outside the production deployment tree.
- **Exact next action:** Complete the new local and published beta gates. Build a file-level production candidate from the verified beta and pinned production tree, keeping the production legal/support content and following the artifact exclusion check.

## Checkpoint 14 · Updated beta candidate published for QA

- Beta `main` advanced to [`a33cee0a3e33d999492561bf6ea0dc17b6fc6f20`](https://github.com/jjaren-hub/roadshop-beta/commit/a33cee0a3e33d999492561bf6ea0dc17b6fc6f20). Remote tree `1719df3339750c9cf1f002ccf88e4a1592b1a929` exactly matches the local test tree. Working files in this commit are `workspace.html`, `workspace.js`, `sw.js` and `.github/qa/browser-auth-first.mjs`.
- Local tests passed: all 11 static suites, 234 explicitly counted assertions, the EIA parser, installed service-worker update test and all five Chromium occupation workflows. The browser now verifies network and console errors, the same-origin diesel observation, and the exact trucking navigation labels.
- The first beta candidate's CI remains recorded. The updated candidate replaces it for approval because it changes the shipped dashboard.
- Production roll-forward inventory is complete. Confirmed the existing production log and README were also directly served. The baseline tree has no tracked production GitHub Actions workflow. Keep verification suites in beta and execute production checks against the promotion assets from there.
- **Exact next action:** Monitor both new beta runs and independently match the 69 assets. Stage only the approved application files and protected production overrides once these gates pass. Verify the private artifact exclusion on the production candidate before publication.

## Checkpoint 15 · Approved beta and production projection verified locally

- Approved exact beta SHA: `a33cee0a3e33d999492561bf6ea0dc17b6fc6f20`. [Pages 46101411965](https://github.com/jjaren-hub/roadshop-beta/actions/runs/46101411965) and [QA 46101412635](https://github.com/jjaren-hub/roadshop-beta/actions/runs/46101412635) passed. [Browser job 140844466712](https://github.com/jjaren-hub/roadshop-beta/actions/runs/46101412635/job/140844466712) completed all five occupation workflows with the enhanced console/network checks. Official and independent byte verification matched 69 assets.
- The production projection overlays 33 changed application files and the new card script/data asset on the verified production tree. It retains production `_headers`, robots policy, Supabase configuration and code, web manifest, support, privacy and terms. Its service worker has the production cache identifier `roadshop-earnkeep-production-20261127-7`.
- PROD-01 candidate removes the 15 QA scripts and the two development documents from production's static root. Their exact source remains in Git history. The existing EIA refresh workflow and parser are included solely to update the same-origin public data weekly, and the new Cloudflare redirect rules prevent direct publishing of the operational GitHub paths. Existing Cloudflare settings, domain and headers remain intact.
- The production projection passed local static security, service-worker navigation/update, and all five Chromium browser workflows. The EIA parser also fetched the real source successfully in a scratch fixture and validated the current observation.
- Production `main` still points to `210fa5fecc9f278a4ff9044037e887e9ca052c41`.
- **Exact next action:** Create the production projection commit on an isolated preview ref, verify its Cloudflare preview bytes, redirects, and artifact exclusion, then perform the guarded fast-forward of production `main`.

## Checkpoint 16 · Production preview deployed

- RoadShop projection commit [`d2dfa0e6c4639c3c3bf5ece6a68493beb5dbb056`](https://github.com/jjaren-hub/RoadShop/commit/d2dfa0e6c4639c3c3bf5ece6a68493beb5dbb056) has one parent, `210fa5fecc9f278a4ff9044037e887e9ca052c41`. Its 75 tracked file hashes exactly match the locally tested projection. Of those, 71 are expected public static files, two are deployment control files and two are protected data-refresh sources.
- The isolated production [preview](https://a963554e.roadshop.pages.dev/) finished deployment. [Cloudflare check 140845335675](https://github.com/jjaren-hub/RoadShop/runs/140845335675), deployment `a963554e-1603-4711-86a7-8b0cacd4f8ad`. Production `main` and `earnkeep.app` are still on the original release.
- **Exact next action:** Verify the preview's 71 files, headers, redirects, 20 protected/removed paths and browser workflows. Capture a fictional pre-release production workspace for cross-version continuity checks. Fast-forward production only after these checks pass.

## Checkpoint 17 · Preview public assets and continuity baseline checked

- The immutable Cloudflare preview matched all 71 public asset hashes, production HTTP security headers, canonical account alias/query handling and all 20 artifact exclusion checks. The 15 former QA paths and the two current refresh paths redirect to the site root. The old development notes and this recovery log do not serve their original content.
- The exact production tree passed all 11 local static suites plus the service-worker update test. Captured a fictional workspace and a $42.17 ledger row on the existing live production origin in an isolated browser profile. No real authentication or customer data was used.
- An initial preview browser run used the beta fixture hostname and was blocked by the deliberately tighter production HTTP CSP. A separate test harness now intercepts the configured production Supabase hostname with fictional responses, with the real HTTP policy intact. It also uses the workspace-proxied public asset transport for the backup migration fixture. No candidate application data or assertions changed.
- **Exact next action:** Wait for the adjusted preview browser run to finish. If it passes, guard the production `main` fast-forward and verify the live byte hashes, continuity fixture, browser suite and real Google sign-in initiation.

## Checkpoint 18 · Preview browser network isolation

- The published preview's trucking scenario completed, including offline install-style behavior. The same full run reached the mechanic test's workspace-switch fixture and then timed out. Independent retries timed out at different earlier navigations, including the public landing and sign-up pages. Targeted unauthenticated Chromium navigation confirmed the preview responds with its correct pages and preserves the switch query.
- The GitHub Pages official browser suite and the complete local projected build already passed. The remaining preview gate is an actual browser run through the workspace's reliable HTTP transport with unchanged preview bytes, original headers and redirects, and the same mock-backend assertions. This does not require any repository or live configuration change.
- Captured a separate genuinely installed browser profile with the old live cache. It is waiting for the new cache to be served, to test activation, cache cleanup, offline navigation and reconnection.
- Production remains on `210fa5fecc9f278a4ff9044037e887e9ca052c41`. **Exact next action:** Finish the Cloudflare preview browser checks with reliable asset transport. Diagnose and address any repeatable app failure before advancing production `main`.
