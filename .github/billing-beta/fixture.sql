create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema roadshop_private;

create table auth.users (
  id uuid primary key, created_at timestamptz not null default now(),
  is_anonymous boolean not null default false, raw_app_meta_data jsonb not null
);
create table public.rs_billing_config (
  singleton boolean primary key, checkout_enabled boolean not null, trial_enabled boolean not null,
  eligible_from timestamptz not null, trial_days integer not null, promotion_codes boolean not null
);
insert into public.rs_billing_config values (true, true, true, now() - interval '1 day', 7, false);
create table public.rs_plans (
  code text primary key, stripe_price text not null, amount_cents integer not null,
  interval text not null, enabled boolean not null
);
insert into public.rs_plans values ('basic', 'price_fixture', 499, 'month', true);
create table public.rs_subscriptions (
  user_id uuid primary key references auth.users(id), customer_id text unique,
  subscription_id text unique, plan text, status text not null default 'none',
  period_end timestamptz, trial_end timestamptz, cancel_at_period_end boolean not null default false,
  trial_used boolean not null default false, snapshot_at timestamptz,
  attempt uuid, attempt_plan text, attempt_until timestamptz, attempt_trial integer
);
create table public.rs_events (
  event_id text primary key, event_type text not null, customer_id text not null, invoice_id text
);
grant select, update on public.rs_subscriptions to service_role;
grant insert on public.rs_events to service_role;
