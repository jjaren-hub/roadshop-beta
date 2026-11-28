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
