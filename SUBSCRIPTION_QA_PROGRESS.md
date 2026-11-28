# EarnKeep subscription QA progress

## Baseline · 2026-11-28

- Scope: beta subscription preview and actual application. Cover unregistered, unsubscribed, trial, expired trial, paid, canceled but paid-through, expired paid and failed renewal. Verify $4.99 monthly pricing, checkout and account redirects, local record read-only access, PDF/CSV/backup recovery, mobile and desktop, and PWA updates.
- Starting beta main: `4bcddfd5dff51634858595f5ba0953ed3595a896`. This progress log is on `qa/subscription-end-to-end` to keep internal QA details outside deployed Pages assets.
- Boundaries: Inspect the shared backend without changing its flags or deployment. Keep live payments and global enforcement off. Use isolated synthetic records and pretend backend responses for writes. The user prohibited deleting existing records and clearing storage containing financial records. Production is out of scope.
- Results: Baseline pinned. No test results yet.
- **Next action:** Inspect current subscription/access policy, shared configuration and QA suites. Establish a safe browser fixture for the actual beta application before exercising mutations. Identify Stripe test mode capability without creating a checkout session until its isolated test boundary is proven.
