-- User subscription profile table for quick lookup of
-- email, signup timestamp, and current subscription tier.

create table if not exists public.user_subscription_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  signed_up_at timestamptz not null,
  subscription_tier text not null check (subscription_tier in ('starter', 'pro', 'team')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_subscription_profiles enable row level security;

drop policy if exists "users_select_own_subscription_profile" on public.user_subscription_profiles;
create policy "users_select_own_subscription_profile"
  on public.user_subscription_profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.user_subscription_profiles from anon, authenticated;
grant select on table public.user_subscription_profiles to authenticated;

create or replace function public.sync_user_subscription_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := 'starter';
begin
  select s.plan_code
  into v_plan
  from public.subscriptions s
  where s.user_id = new.id
    and s.status = 'active'
  order by s.created_at desc
  limit 1;

  insert into public.user_subscription_profiles (
    user_id,
    email,
    signed_up_at,
    subscription_tier
  )
  values (
    new.id,
    coalesce(new.email, ''),
    new.created_at,
    coalesce(v_plan, 'starter')
  )
  on conflict (user_id) do update
  set email = excluded.email,
      signed_up_at = excluded.signed_up_at,
      subscription_tier = excluded.subscription_tier,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_subscription_profile_sync on auth.users;
create trigger on_auth_user_subscription_profile_sync
after insert or update of email on auth.users
for each row
execute function public.sync_user_subscription_profile_from_auth();

create or replace function public.sync_user_subscription_profile_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_signed_up_at timestamptz;
begin
  if new.status <> 'active' then
    return new;
  end if;

  update public.user_subscription_profiles
  set subscription_tier = new.plan_code,
      updated_at = now()
  where user_id = new.user_id;

  if found then
    return new;
  end if;

  select u.email, u.created_at
  into v_email, v_signed_up_at
  from auth.users u
  where u.id = new.user_id;

  if v_email is null then
    return new;
  end if;

  insert into public.user_subscription_profiles (
    user_id,
    email,
    signed_up_at,
    subscription_tier
  )
  values (
    new.user_id,
    v_email,
    v_signed_up_at,
    new.plan_code
  )
  on conflict (user_id) do update
  set email = excluded.email,
      signed_up_at = excluded.signed_up_at,
      subscription_tier = excluded.subscription_tier,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_subscription_profile_sync on public.subscriptions;
create trigger on_subscription_profile_sync
after insert or update of plan_code, status on public.subscriptions
for each row
execute function public.sync_user_subscription_profile_from_subscription();

insert into public.user_subscription_profiles (
  user_id,
  email,
  signed_up_at,
  subscription_tier
)
select
  u.id,
  coalesce(u.email, ''),
  u.created_at,
  coalesce(
    (
      select s.plan_code
      from public.subscriptions s
      where s.user_id = u.id
        and s.status = 'active'
      order by s.created_at desc
      limit 1
    ),
    'starter'
  ) as subscription_tier
from auth.users u
on conflict (user_id) do update
set email = excluded.email,
    signed_up_at = excluded.signed_up_at,
    subscription_tier = excluded.subscription_tier,
    updated_at = now();
