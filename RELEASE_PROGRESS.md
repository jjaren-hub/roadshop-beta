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
