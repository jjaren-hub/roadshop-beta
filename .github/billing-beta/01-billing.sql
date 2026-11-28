begin;

alter table public.rs_subscriptions
  add column paid_through timestamptz,
  add column test_clock_at timestamptz,
  add column beta_snapshot_revision bigint not null default 0;

create sequence roadshop_private.rs_beta_snapshot_revision_seq;

create function public.rs_beta_snapshot_revision()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select pg_catalog.nextval('roadshop_private.rs_beta_snapshot_revision_seq');
$$;

create function public.rs_beta_apply_snapshot(
  p_user uuid, p_customer text, p_subscription text, p_plan text, p_status text,
  p_end timestamptz, p_trial timestamptz, p_cancel boolean, p_paid_through timestamptz,
  p_test_clock_at timestamptz, p_revision bigint, p_event text, p_type text, p_invoice text
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  current_revision bigint;
begin
  select beta_snapshot_revision into current_revision
    from public.rs_subscriptions
    where user_id = p_user and customer_id = p_customer for update;
  if not found then raise exception 'CUSTOMER_UNKNOWN'; end if;

  if p_event is not null then
    insert into public.rs_events(event_id, event_type, customer_id, invoice_id)
      values (p_event, p_type, p_customer, p_invoice) on conflict do nothing;
    if not found then return false; end if;
  end if;
  if p_revision <= current_revision then return false; end if;

  update public.rs_subscriptions set
    subscription_id = p_subscription,
    plan = p_plan,
    status = p_status,
    period_end = p_end,
    trial_end = p_trial,
    cancel_at_period_end = p_cancel,
    paid_through = p_paid_through,
    test_clock_at = p_test_clock_at,
    trial_used = trial_used or p_subscription is not null,
    snapshot_at = clock_timestamp(),
    beta_snapshot_revision = p_revision,
    attempt_until = case
      when p_subscription is not null and p_status not in ('canceled', 'incomplete_expired') then null
      else attempt_until
    end
    where user_id = p_user;
  return true;
end;
$$;

create function public.rs_beta_checkout_reserve(p_user uuid, p_plan text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  config public.rs_billing_config%rowtype;
  plan public.rs_plans%rowtype;
  subscription public.rs_subscriptions%rowtype;
  born timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text, 9));
  select created_at into born from auth.users
    where id = p_user and not is_anonymous
      and raw_app_meta_data -> 'earnkeep_subscription_beta' = 'true'::jsonb;
  if not found then raise exception 'USER_DENIED'; end if;

  select * into strict config from public.rs_billing_config where singleton;
  select * into plan from public.rs_plans
    where code = p_plan and code = 'basic' and enabled and amount_cents = 499 and interval = 'month';
  if not config.checkout_enabled or plan.stripe_price is null then
    raise exception 'CHECKOUT_DISABLED';
  end if;

  insert into public.rs_subscriptions(user_id) values (p_user) on conflict do nothing;
  select * into strict subscription from public.rs_subscriptions
    where user_id = p_user for update;
  if subscription.status not in ('none', 'canceled', 'incomplete_expired') then
    raise exception 'MANAGE_EXISTING';
  end if;

  if subscription.attempt_until > now() then
    if subscription.attempt_plan <> p_plan then raise exception 'CHECKOUT_PENDING'; end if;
  else
    update public.rs_subscriptions set
      attempt = gen_random_uuid(),
      attempt_plan = p_plan,
      attempt_until = date_trunc('second', now() + interval '60 minutes'),
      attempt_trial = case
        when config.trial_enabled and not subscription.trial_used
          and born >= config.eligible_from and config.trial_days = 7 then 7
        else 0
      end
      where user_id = p_user returning * into subscription;
  end if;
  return jsonb_build_object(
    'attempt', subscription.attempt,
    'expires', extract(epoch from subscription.attempt_until)::bigint,
    'trial', subscription.attempt_trial,
    'customer', subscription.customer_id,
    'price', plan.stripe_price,
    'amount', plan.amount_cents,
    'interval', plan.interval,
    'promotion', config.promotion_codes
  );
end;
$$;

revoke all on function public.rs_beta_snapshot_revision() from public, anon, authenticated;
revoke all on function public.rs_beta_checkout_reserve(uuid, text) from public, anon, authenticated;
revoke all on function public.rs_beta_apply_snapshot(uuid, text, text, text, text, timestamptz,
  timestamptz, boolean, timestamptz, timestamptz, bigint, text, text, text)
  from public, anon, authenticated;

grant execute on function public.rs_beta_snapshot_revision() to service_role;
grant execute on function public.rs_beta_checkout_reserve(uuid, text) to service_role;
grant execute on function public.rs_beta_apply_snapshot(uuid, text, text, text, text, timestamptz,
  timestamptz, boolean, timestamptz, timestamptz, bigint, text, text, text) to service_role;

commit;
