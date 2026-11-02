-- EXPERIMENTAL ONLY. Review and apply to a staging Supabase project first.
create table if not exists public.phone_auth_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_e164 text not null unique,
  status text not null default 'pending' check (status in ('pending','approved','denied','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz
);
create table if not exists public.phone_auth_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('approve','deny','revoke')),
  term text,
  created_at timestamptz not null default now()
);
-- Lifetime phone licenses require a nullable expiry; existing email licenses remain unchanged.
alter table public.licenses alter column expires_at drop not null;
alter table public.phone_auth_accounts enable row level security;
alter table public.phone_auth_audit enable row level security;
revoke all on public.phone_auth_accounts, public.phone_auth_audit from anon, authenticated;
grant all on public.phone_auth_accounts, public.phone_auth_audit to service_role;

-- Preserve Gmail and Admin behavior; allow approved phone accounts with active licenses.
create or replace function public.check_email_license()
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text;
  v_role text;
  v_license record;
begin
  select email into v_email from auth.users where id = auth.uid();
  select role into v_role from public.profiles where id = auth.uid();

  if v_role = 'admin' or exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then
    return json_build_object('success',true,'active',true,'is_admin',true,
      'email',v_email,'expires_at',null,'message','Admin');
  end if;

  select el.expires_at into v_license
  from public.email_licenses el
  where el.user_id = auth.uid() and el.active = true and el.expires_at > now();

  if found then
    return json_build_object('success',true,'active',true,'is_admin',false,
      'email',v_email,'expires_at',v_license.expires_at,'message','License còn hạn');
  end if;

  if exists (
    select 1 from public.phone_auth_accounts pa
    join public.licenses l on l.user_id = pa.user_id
    where pa.user_id = auth.uid()
      and pa.status = 'approved'
      and l.active = true
      and (l.expires_at is null or l.expires_at > now())
  ) then
    select l.expires_at into v_license
    from public.licenses l where l.user_id = auth.uid() and l.active = true
      and (l.expires_at is null or l.expires_at > now());
    return json_build_object('success',true,'active',true,'is_admin',false,
      'email',v_email,'expires_at',v_license.expires_at,'message','Phone license còn hạn');
  end if;

  return json_build_object('success',false,'active',false,'is_admin',false,
    'email',v_email,'expires_at',null,'message','Tài khoản chưa có bản quyền.');
end;
$function$;

-- Persistent per-phone throttling. Only the service role may consume limits.
create table if not exists public.phone_auth_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.phone_auth_rate_limits enable row level security;
revoke all on public.phone_auth_rate_limits from anon, authenticated;
grant all on public.phone_auth_rate_limits to service_role;

create or replace function public.phone_auth_consume_rate_limit(
  p_key_hash text,
  p_max_attempts integer default 5,
  p_window_seconds integer default 900
) returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count integer;
begin
  if auth.role() <> 'service_role'
     or p_key_hash is null
     or length(p_key_hash) <> 64
     or p_max_attempts < 1 or p_max_attempts > 20
     or p_window_seconds < 60 or p_window_seconds > 3600 then
    return false;
  end if;
  insert into public.phone_auth_rate_limits(key_hash,window_started_at,attempt_count,updated_at)
  values(p_key_hash,now(),1,now())
  on conflict(key_hash) do update set
    window_started_at = case
      when public.phone_auth_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
      else public.phone_auth_rate_limits.window_started_at end,
    attempt_count = case
      when public.phone_auth_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
      else public.phone_auth_rate_limits.attempt_count + 1 end,
    updated_at = now()
  returning attempt_count into v_count;
  return v_count <= p_max_attempts;
end;
$function$;
revoke all on function public.phone_auth_consume_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.phone_auth_consume_rate_limit(text,integer,integer) to service_role;
