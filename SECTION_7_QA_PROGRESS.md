# EarnKeep Section 7 beta QA

## Baseline · 2026-11-28

- Scope: final beta subscription, browser, security, billing-copy/legal and full regression review. Sections 1–6 and 43/64 tasks are owner-reported complete. Prior [subscription QA](https://github.com/jjaren-hub/roadshop-beta/blob/qa/subscription-end-to-end/SUBSCRIPTION_QA_PROGRESS.md) read. Owner-reported Stripe Sandbox lifecycle evidence supersedes the earlier configuration blocker as historical context.
- Starting beta `84ae2a3045df5d3e3016cdb0538e8720a693a411`. Starting production `9945624ec93b31cfcd2f6975342894d6fc8102e0`. Production inspection is read-only. Scope ends at Section 7.
- This log lives on `qa/section-7` outside deployed Pages assets. Keep shared enforcement/live payments untouched. Use anonymous browser flows, read-only backend inspection, and isolated fictional fixtures. Physical device results require device evidence.
- Current phase: inventory. No tests executed on the pinned build yet.
- **Next:** Compare subscription changes since the prior QA, inspect the deployed billing server and data permissions, verify public browser/copy behavior, then run and repair beta regressions.
