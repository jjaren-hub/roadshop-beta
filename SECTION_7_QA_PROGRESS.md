# EarnKeep Section 7 beta QA

## Baseline · 2026-11-28

- Scope: final beta subscription, browser, security, billing-copy/legal and full regression review. Sections 1–6 and 43/64 tasks are owner-reported complete. Prior [subscription QA](https://github.com/jjaren-hub/roadshop-beta/blob/qa/subscription-end-to-end/SUBSCRIPTION_QA_PROGRESS.md) read. Owner-reported Stripe Sandbox lifecycle evidence supersedes the earlier configuration blocker as historical context.
- Starting beta `84ae2a3045df5d3e3016cdb0538e8720a693a411`. Starting production `9945624ec93b31cfcd2f6975342894d6fc8102e0`. Production inspection is read-only. Scope ends at Section 7.
- This log lives on `qa/section-7` outside deployed Pages assets. Keep shared enforcement/live payments untouched. Use anonymous browser flows, read-only backend inspection, and isolated fictional fixtures. Physical device results require device evidence.
- Current phase: inventory. No tests executed on the pinned build yet.
- **Next:** Compare subscription changes since the prior QA, inspect the deployed billing server and data permissions, verify public browser/copy behavior, then run and repair beta regressions.

## Baseline findings

- [Pages run 46151192477](https://github.com/jjaren-hub/roadshop-beta/actions/runs/46151192477) passed. [Prelaunch QA run 46151191971](https://github.com/jjaren-hub/roadshop-beta/actions/runs/46151191971) failed at `tests/commercial.mjs:26` because two fixtures still expect write access for terminal canceled subscriptions with future dates. Current policy distinguishes scheduled cancellation from terminal cancellation. Update those fixtures and cover both states.
- Deployed commercial and Stripe webhook Edge Functions are at version 4. Read-only metadata confirmed RLS enabled on all nine billing tables and no anonymous or authenticated table access or public billing RPC execution for the grants checked. Global enforcement remains off. Basic is enabled at 499 cents monthly, the seven-day trial is enabled, and support email matches the owner-provided spelling.
- The existing Support page hides the email during sign-out or status failure. The beta pricing pages defer renewal disclosures to Stripe. Review and cover public contact, recovery copy and pricing disclosures.
- **Next:** Confirm public browser behavior, finish server review, then fix stale fixtures and beta customer-facing defects.

## Browser and candidate milestone

- Interactive desktop Chrome opened the published landing, subscription and support pages, then selected failed renewal and opened the fictional preview. The baseline Support page offered sign-in only and the preview displayed record and export recovery. Browser metadata errors were extension-generated. No customer records or Stripe sessions were touched.
- Candidate fixes in `commercial.js`, `index.html`, `subscribe.html`, `subscribe.js`, `support.html`, `sw.js`, and `terms.html`: actual Billing checkout cancellation and success notices, failed-payment recovery, persistent public support contact, pre-checkout terms, clearer cancellation language, and cache revision. The regression files now exercise the actual server-configured Billing return and both scheduled and terminal canceled states.
- Candidate static/accounting suites exited zero. Subscription browser suite passed 157 counted assertions (40 simulation, 117 actual app with fictional intercepted backend). Service-worker navigation suite passed. Full browser and hosted asset checks pending.
- Shared billing security review found follow-up gates for owner review and isolated Sandbox verification. Deployment of a shared backend change is outside this beta-only scope. No backend settings were changed.
- **Next:** Complete the full browser suite, check viewport and production isolation evidence, and commit the scoped beta repair after local checks.
