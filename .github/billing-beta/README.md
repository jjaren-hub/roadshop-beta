# Isolated billing candidate

This candidate starts from the two deployed version 4 Edge Functions. The scope is the Section 7 billing and security blockers. The candidate lives on `qa/section-7` and needs an isolated Supabase and Stripe Sandbox deployment for acceptance.

## Isolated setup

1. Use a separate Supabase project with the billing schema, empty billing data, and fictional users. Run `01-billing.sql` only in that project. Keep global enforcement disabled.
2. Set `ROADSHOP_BILLING_BETA_PROJECT_REF` to the isolated project ref. Billing requires that ref to match `SUPABASE_URL` and rejects the shared project. Set `ROADSHOP_APP_URL` to the isolated beta frontend origin and path. Configure the frontend build with this isolated project's public Supabase URL and publishable key.
3. Deploy both Edge Functions from the directories here with the shared module. Keep JWT verification enabled for commercial and disabled for the webhook. Supply Stripe Sandbox keys and the webhook signing secret in the isolated project's secrets. Set `ROADSHOP_STRIPE_TEST_ENABLED` for that project. Use a Sandbox $4.99 monthly Basic price and the matching checkout/portal settings.
4. Enroll designated accounts with server-managed `earnkeep_subscription_beta` app metadata. Use separate fixtures for unenrolled and enrolled accounts. Complete the outstanding matrix in the Section 7 log before approval. Imported Sandbox accounts require a fresh Stripe snapshot before paid editing.

## Focused test

Run `node .github/billing-beta/run.mjs <postgres-bin-dir> <absolute-pg-module-path>` with Node 24, PostgreSQL and `pg`. The harness opens a private disposable database on a Unix socket, runs the actual migration, and intercepts all provider requests. The GitHub Actions workflow runs this test on the QA branch. If local sockets are unavailable, run `node .github/billing-beta/run.mjs --wasm <absolute-pglite-module-path>`. The WASM path runs the SQL with serialized database sessions and still overlaps Edge Function requests.
