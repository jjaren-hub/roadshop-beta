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
