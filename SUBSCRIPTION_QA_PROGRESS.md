# EarnKeep subscription QA progress

## Baseline · 2026-11-28

- Scope: beta subscription preview and actual application. Cover unregistered, unsubscribed, trial, expired trial, paid, canceled but paid-through, expired paid and failed renewal. Verify $4.99 monthly pricing, checkout and account redirects, local record read-only access, PDF/CSV/backup recovery, mobile and desktop, and PWA updates.
- Starting beta main: `4bcddfd5dff51634858595f5ba0953ed3595a896`. This progress log is on `qa/subscription-end-to-end` to keep internal QA details outside deployed Pages assets.
- Boundaries: Inspect the shared backend without changing its flags or deployment. Keep live payments and global enforcement off. Use isolated synthetic records and pretend backend responses for writes. The user prohibited deleting existing records and clearing storage containing financial records. Production is out of scope.
- Results: Baseline pinned. No test results yet.
- **Next action:** Inspect current subscription/access policy, shared configuration and QA suites. Establish a safe browser fixture for the actual beta application before exercising mutations. Identify Stripe test mode capability without creating a checkout session until its isolated test boundary is proven.

## Baseline findings and browser preview

- Opened the public simulation in interactive Chrome. Confirmed all eight labeled states, $4.99 and seven days, registration handoff, simulated checkout cancel/success, trial activation and expiration, cancellation with remaining access, resume, failed renewal, and simulated CSV and backup recovery. Simulation has no Stripe or account effect.
- SUB-01: The subscription state currently only adds a workspace link. `LocalBooks` and the alternate offline/backup/account write paths do not enforce read-only status. There is no safe per-account beta enrollment yet.
- SUB-02: The status checks disagree about canceled paid-through access. Billing opens checkout and portal URLs without test-only validation, and subscribe only validates after calling the backend. A deployment mode must be confirmed before the shared backend receives any checkout or portal request from beta.
- SUB-03: Preview access is illustrative. Actual checkout returns and matching lifecycle need dedicated browser coverage. Shared backend source, Stripe sandbox configuration and a dedicated opted-in test identity have not been verified.
- Plan: confine changes to the exact deployed beta origin and an owner-assigned auth app-metadata marker. Require authenticated server status for write operations by those accounts. Keep reads and downloads available. Require an explicit server test-mode assertion before calling Stripe-related actions on beta. Use an intercepted provider for safely replaying activation, cancellation and renewal. Preserve non-enrolled accounts and existing offline behavior.
- **Next action:** Implement subscription state handling, persistence guards, checkout safety and focused interactive browser fixtures. Record any real backend/Stripe validation dependency for the owner.
