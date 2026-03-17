-- Lock billing plans to Starter/Pro/Team and provide plan presets.

update public.subscriptions
set plan_code = 'team'
where plan_code = 'enterprise';

alter table public.subscriptions drop constraint if exists subscriptions_plan_code_check;
alter table public.subscriptions
  add constraint subscriptions_plan_code_check
  check (plan_code in ('starter', 'pro', 'team'));

create or replace function public.billing_plan_defaults(p_plan_code text)
returns table (
  included_scans integer,
  included_ai_fixes integer,
  overage_ai_fix_enabled boolean,
  overage_ai_fix_price_cents integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_plan_code = 'starter' then
    return query select 5, 10, false, 0;
  elsif p_plan_code = 'pro' then
    return query select 100, 300, true, 3;
  elsif p_plan_code = 'team' then
    return query select 500, 2000, true, 2;
  else
    raise exception 'Unsupported plan code: %', p_plan_code;
  end if;
end;
$$;

create or replace function public.billing_set_plan(p_plan_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_subscription public.subscriptions;
  v_defaults record;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_plan_code not in ('starter', 'pro', 'team') then
    raise exception 'Unsupported plan code: %', p_plan_code;
  end if;

  v_subscription := public.billing_get_or_create_subscription(v_user_id);
  select * into v_defaults from public.billing_plan_defaults(p_plan_code);

  update public.subscriptions
  set plan_code = p_plan_code,
      included_scans = v_defaults.included_scans,
      included_ai_fixes = v_defaults.included_ai_fixes,
      overage_ai_fix_enabled = v_defaults.overage_ai_fix_enabled,
      overage_ai_fix_price_cents = v_defaults.overage_ai_fix_price_cents,
      updated_at = now()
  where id = v_subscription.id;

  return public.billing_build_usage_summary(v_user_id);
end;
$$;

grant execute on function public.billing_set_plan(text) to authenticated, service_role;
revoke all on function public.billing_plan_defaults(text) from public, anon, authenticated;
