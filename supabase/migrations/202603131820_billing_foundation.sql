-- Billing foundation for Vibesec.
-- Units:
--   - scan_run
--   - ai_fix

create extension if not exists pgcrypto;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null check (plan_code in ('starter', 'pro', 'team', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  included_scans integer not null default 5 check (included_scans >= 0),
  included_ai_fixes integer not null default 10 check (included_ai_fixes >= 0),
  overage_ai_fix_enabled boolean not null default false,
  overage_ai_fix_price_cents integer not null default 3 check (overage_ai_fix_price_cents >= 0),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_period_check check (period_end > period_start)
);

create unique index if not exists subscriptions_user_active_idx
  on public.subscriptions (user_id)
  where status = 'active';

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  unit text not null check (unit in ('scan_run', 'ai_fix')),
  quantity integer not null default 1 check (quantity > 0),
  billable_overage boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_created_idx on public.usage_events(user_id, created_at desc);
create index if not exists usage_events_subscription_created_idx on public.usage_events(subscription_id, created_at desc);

alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;

drop policy if exists "users_select_own_subscriptions" on public.subscriptions;
create policy "users_select_own_subscriptions"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users_select_own_usage_events" on public.usage_events;
create policy "users_select_own_usage_events"
  on public.usage_events
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at_timestamp();

create or replace function public.billing_get_or_create_subscription(p_user_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.subscriptions;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  select *
  into v_subscription
  from public.subscriptions
  where user_id = p_user_id and status = 'active'
  order by created_at desc
  limit 1;

  if v_subscription.id is null then
    v_period_start := date_trunc('month', now());
    v_period_end := v_period_start + interval '1 month';

    insert into public.subscriptions (
      user_id,
      plan_code,
      status,
      period_start,
      period_end,
      included_scans,
      included_ai_fixes,
      overage_ai_fix_enabled,
      overage_ai_fix_price_cents
    )
    values (
      p_user_id,
      'starter',
      'active',
      v_period_start,
      v_period_end,
      5,
      10,
      false,
      3
    )
    returning * into v_subscription;
  end if;

  if now() >= v_subscription.period_end then
    v_period_start := date_trunc('month', now());
    v_period_end := v_period_start + interval '1 month';

    update public.subscriptions
    set period_start = v_period_start,
        period_end = v_period_end,
        updated_at = now()
    where id = v_subscription.id
    returning * into v_subscription;
  end if;

  return v_subscription;
end;
$$;

create or replace function public.billing_build_usage_summary(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.subscriptions;
  v_used_scans integer := 0;
  v_used_ai_fixes integer := 0;
  v_remaining_scans integer := 0;
  v_remaining_ai_fixes integer := 0;
  v_overage_ai_fixes integer := 0;
  v_can_run_scan boolean := false;
  v_can_run_ai_fix boolean := false;
  v_ai_fix_unit_price_cents integer := 0;
begin
  v_subscription := public.billing_get_or_create_subscription(p_user_id);

  select
    coalesce(sum(quantity) filter (where unit = 'scan_run'), 0)::integer,
    coalesce(sum(quantity) filter (where unit = 'ai_fix'), 0)::integer
  into
    v_used_scans,
    v_used_ai_fixes
  from public.usage_events
  where subscription_id = v_subscription.id
    and created_at >= v_subscription.period_start
    and created_at < v_subscription.period_end;

  v_remaining_scans := greatest(v_subscription.included_scans - v_used_scans, 0);
  v_remaining_ai_fixes := greatest(v_subscription.included_ai_fixes - v_used_ai_fixes, 0);
  v_overage_ai_fixes := greatest(v_used_ai_fixes - v_subscription.included_ai_fixes, 0);

  v_can_run_scan := v_remaining_scans > 0;
  v_can_run_ai_fix := (v_remaining_ai_fixes > 0) or v_subscription.overage_ai_fix_enabled;

  if v_remaining_ai_fixes > 0 then
    v_ai_fix_unit_price_cents := 0;
  elsif v_subscription.overage_ai_fix_enabled then
    v_ai_fix_unit_price_cents := v_subscription.overage_ai_fix_price_cents;
  else
    v_ai_fix_unit_price_cents := 0;
  end if;

  return jsonb_build_object(
    'subscriptionId', v_subscription.id,
    'planCode', v_subscription.plan_code,
    'status', v_subscription.status,
    'periodStart', v_subscription.period_start,
    'periodEnd', v_subscription.period_end,
    'includedScans', v_subscription.included_scans,
    'usedScans', v_used_scans,
    'remainingScans', v_remaining_scans,
    'includedAiFixes', v_subscription.included_ai_fixes,
    'usedAiFixes', v_used_ai_fixes,
    'remainingAiFixes', v_remaining_ai_fixes,
    'overageAiFixes', v_overage_ai_fixes,
    'overageAiFixEnabled', v_subscription.overage_ai_fix_enabled,
    'overageAiFixPriceCents', v_subscription.overage_ai_fix_price_cents,
    'canRunScan', v_can_run_scan,
    'canRunAiFix', v_can_run_ai_fix,
    'aiFixUnitPriceCents', v_ai_fix_unit_price_cents
  );
end;
$$;

create or replace function public.billing_get_usage_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return public.billing_build_usage_summary(v_user_id);
end;
$$;

create or replace function public.billing_can_use_unit(p_unit text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_summary jsonb;
  v_allowed boolean := false;
  v_reason text := null;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_unit not in ('scan_run', 'ai_fix') then
    raise exception 'Unsupported billing unit: %', p_unit;
  end if;

  v_summary := public.billing_build_usage_summary(v_user_id);

  if p_unit = 'scan_run' then
    v_allowed := coalesce((v_summary->>'canRunScan')::boolean, false);
    if not v_allowed then
      v_reason := 'Scan quota reached for this billing period.';
    end if;
  else
    v_allowed := coalesce((v_summary->>'canRunAiFix')::boolean, false);
    if not v_allowed then
      v_reason := 'AI fix quota reached for this billing period.';
    end if;
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'summary', v_summary
  );
end;
$$;

create or replace function public.billing_record_usage(
  p_unit text,
  p_quantity integer default 1,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_subscription public.subscriptions;
  v_can_use jsonb;
  v_allowed boolean := false;
  v_reason text;
  v_summary jsonb;
  v_billable_overage boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_unit not in ('scan_run', 'ai_fix') then
    raise exception 'Unsupported billing unit: %', p_unit;
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  v_can_use := public.billing_can_use_unit(p_unit);
  v_allowed := coalesce((v_can_use->>'allowed')::boolean, false);
  v_reason := v_can_use->>'reason';

  if not v_allowed then
    return jsonb_build_object(
      'allowed', false,
      'reason', v_reason,
      'summary', v_can_use->'summary'
    );
  end if;

  v_subscription := public.billing_get_or_create_subscription(v_user_id);

  if p_unit = 'ai_fix' then
    v_summary := v_can_use->'summary';
    v_billable_overage := coalesce((v_summary->>'remainingAiFixes')::integer, 0) <= 0
      and coalesce((v_summary->>'overageAiFixEnabled')::boolean, false);
  end if;

  insert into public.usage_events (
    user_id,
    subscription_id,
    unit,
    quantity,
    billable_overage,
    metadata
  )
  values (
    v_user_id,
    v_subscription.id,
    p_unit,
    p_quantity,
    v_billable_overage,
    coalesce(p_meta, '{}'::jsonb)
  );

  v_summary := public.billing_build_usage_summary(v_user_id);

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'summary', v_summary
  );
end;
$$;

revoke all on function public.billing_get_or_create_subscription(uuid) from public, anon, authenticated;
revoke all on function public.billing_build_usage_summary(uuid) from public, anon, authenticated;

grant execute on function public.billing_get_usage_summary() to authenticated, service_role;
grant execute on function public.billing_can_use_unit(text) to authenticated, service_role;
grant execute on function public.billing_record_usage(text, integer, jsonb) to authenticated, service_role;
