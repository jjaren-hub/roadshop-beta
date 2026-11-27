# EarnKeep development log

## 2026-11-27 — customer document business logos (beta)
- Reuse the active local business profile and shared customer document renderer for mechanic work-order quotes, invoices and legacy quick estimates. Logo-free and old customer-link copies remain supported; no logo is added to link payloads.
- Validate bounded PNG/JPEG data URLs and decoded upload dimensions (200 KB, 4096 px per side). No external logo requests or new storage. Existing workspace backup includes profile logo.
- Add bounded aspect-preserving preview/PDF branding and a customer-only print action; retain existing pricing and document numbering.
- Add browser regression coverage for wide PNG, portrait JPEG replacement, removal, PDF generation, print isolation and backup round-trip. Production promotion requires successful beta QA and remaining verification; results pending.

Additional QA: verify desktop and mobile logo geometry, actual canvas draw dimensions for a shared invoice PDF, malformed PNG rejection, portrait JPEG in an existing estimate, logo-free estimate after removal, and backed-up logo restored in a separate fixture workspace without leaking into the original workspace. Browser and production verification are not yet complete.

## 2026-11-27 — beta QA navigation correction
- Two QA attempts passed static/accounting and deployment checks but timed out waiting for the recovered mechanic business dashboard immediately after account selection. Account selection intentionally opens the mechanic Ledger first.
- Correct the test to wait for the Ledger, verify the active local workspace ID, owner and business profile, then explicitly open the Dashboard. Check both restored and original quote previews and persisted logos; keep workspace isolation assertions intact.
- User reported beta authentication working after adding production/beta redirect allowlist entries and supplied an Android print-to-PDF preview showing the business logo. This manual check does not replace automated recovery verification.
- No application or production changes in this commit. Full beta QA rerun required before promotion.

## 2026-11-27 — mechanic shop supply charge shortcut (beta)
- Add an explicit Add shop supply charge button to detailed mechanic quotes and quick quotes, using the active business's existing Shop supply charge ($/job) setting. Insert one customer charge with quantity one; allow editing and removal; repeated shortcut taps do not duplicate it. Existing records are not changed.
- Detailed quotes use the existing supplies line type and existing discount, minimum service charge and tax rules (tax checkbox initially off). Quick quotes use the existing manual estimated tax amount and categorize paid supply charges as Shop supplies revenue, not a recorded expense.
- Include charges through existing customer document/PDF projection and payment calculations. Add browser and quick quote payment regression coverage. Bump offline cache. Production promotion requires passing beta QA.

## 2026-11-27 — quote button layout (beta)
- Align quick quote charge actions into a two-column grid, with the mechanic-only shop supply shortcut spanning both columns. Match the existing EarnKeep green controls in light and dark modes, preserve 44px touch targets and keep hidden controls hidden.
- Group detailed quote add-line and supply actions into matching columns. No pricing, accounting, tax, document or navigation behavior changes. Add browser layout assertions at 320, 390 and 1280px. Refresh offline cache; beta quality gate required.

## 2026-11-27 — customer support cleanup
- Remove the outdated customer-facing Release notes card from Help & support. Keep help topics, feedback, account deletion requests, support contacts and legal links unchanged. Retain internal development history; bump offline cache.

## 2026-11-27 — production sign-in callback and service worker navigation
- User confirmed that removing .html from the production OAuth callback resolved Chrome ERR_FAILED; user added both canonical production callback URLs to the existing Supabase allowlist. Generate canonical account and recovery callbacks for earnkeep.app only; retain GitHub Pages account.html callbacks.
- Avoid returning redirected cached responses directly to navigation requests; preserve security headers and query strings, recognize actual extensionless cache aliases, let auth callback requests go straight to the network, and retain offline fallback. No local records are deleted and no authentication credentials or billing settings are changed.
- Accept both production and beta navigation paths in browser tests, check fictional OAuth and email redirect targets, and exercise a real service worker against a local Cloudflare-style redirect server. Require beta validation before production promotion.
