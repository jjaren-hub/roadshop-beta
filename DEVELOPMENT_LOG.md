# EarnKeep development log

## 2026-11-27 — customer document business logos (beta)
- Reuse the active local business profile and shared customer document renderer for mechanic work-order quotes, invoices and legacy quick estimates. Logo-free and old customer-link copies remain supported; no logo is added to link payloads.
- Validate bounded PNG/JPEG data URLs and decoded upload dimensions (200 KB, 4096 px per side). No external logo requests or new storage. Existing workspace backup includes profile logo.
- Add bounded aspect-preserving preview/PDF branding and a customer-only print action; retain existing pricing and document numbering.
- Add browser regression coverage for wide PNG, portrait JPEG replacement, removal, PDF generation, print isolation and backup round-trip. Production promotion requires successful beta QA and remaining verification; results pending.
