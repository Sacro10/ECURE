-- Fix race condition on first subscription bootstrap (React strict mode / concurrent RPC calls).
-- Also aligns starter default overage price to 0 cents.

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
  where user_id = p_user_id
    and status = 'active'
  order by created_at desc
  limit 1;

  if v_subscription.id is null then
    v_period_start := date_trunc('month', now());
    v_period_end := v_period_start + interval '1 month';

    begin
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
        0
      )
      returning * into v_subscription;
    exception
      when unique_violation then
        -- Another concurrent request created the active row first.
        select *
        into v_subscription
        from public.subscriptions
        where user_id = p_user_id
          and status = 'active'
        order by created_at desc
        limit 1;
    end;
  end if;

  if v_subscription.id is null then
    raise exception 'Unable to initialize active subscription for user %', p_user_id;
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
