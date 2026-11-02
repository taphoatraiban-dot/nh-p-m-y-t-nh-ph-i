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
  v_phone_identity boolean;
  v_license record;
begin
  select email into v_email from auth.users where id = auth.uid();
  select role into v_role from public.profiles where id = auth.uid();
  select coalesce(raw_app_meta_data ->> 'auth_method' = 'phone_alias', false)
      or coalesce(raw_app_meta_data ->> 'cuncun_auth_type' = 'phone_password', false)
      or coalesce(email like 'phone-%@accounts.invalid', false)
    into v_phone_identity from auth.users where id = auth.uid();

  -- A phone account must never gain admin privileges from a stale profile role.
  if not coalesce(v_phone_identity, false)
     and not exists (select 1 from public.phone_auth_accounts pa where pa.user_id = auth.uid())
     and (v_role = 'admin' or exists (select 1 from public.admin_users au where au.user_id = auth.uid())) then
    return json_build_object('success',true,'active',true,'is_admin',true,
      'email',v_email,'expires_at',null,'message','Admin');
  end if;

  -- Phone identities must use phone approval and license only, never email licenses.
  if coalesce(v_phone_identity, false) or exists (select 1 from public.phone_auth_accounts pa where pa.user_id = auth.uid()) then
    if exists (
      select 1 from public.phone_auth_accounts pa
      join public.licenses l on l.user_id = pa.user_id
      where pa.user_id = auth.uid() and pa.status = 'approved'
        and l.active = true and (l.expires_at is null or l.expires_at > now())
    ) then
      select l.expires_at into v_license from public.licenses l
      where l.user_id = auth.uid() and l.active = true
        and (l.expires_at is null or l.expires_at > now());
      return json_build_object('success',true,'active',true,'is_admin',false,
        'email',v_email,'expires_at',v_license.expires_at,'message','Phone license còn hạn');
    end if;
    return json_build_object('success',false,'active',false,'is_admin',false,
      'email',v_email,'expires_at',null,'message','Tài khoản SĐT chưa có bản quyền hợp lệ.');
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

-- Experimental atomic admin transitions. Service role only; never expose to browser.
create or replace function public.phone_auth_admin_transition(
  p_admin_id uuid, p_user_id uuid, p_action text, p_term text default null
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_account public.phone_auth_accounts%rowtype;
  v_license public.licenses%rowtype;
  v_expiry timestamptz;
  v_base timestamptz;
  v_months integer;
  v_status text;
begin
  if auth.role() <> 'service_role' then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists (select 1 from public.admin_users where user_id = p_admin_id) then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_action not in ('approve','deny','revoke') or p_action is null then
    raise exception 'INVALID_ACTION';
  end if;
  select * into v_account from public.phone_auth_accounts
    where user_id = p_user_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if p_action = 'approve' then
    if p_term not in ('1m','3m','12m','permanent') or p_term is null then
      raise exception 'INVALID_TERM';
    end if;
    select * into v_license from public.licenses where user_id = p_user_id for update;
    if p_term = 'permanent' or (v_license.active is true and v_license.expires_at is null) then
      v_expiry := null;
    else
      v_months := case p_term when '1m' then 1 when '3m' then 3 else 12 end;
      v_base := case when v_license.active is true and v_license.expires_at > now()
                     then v_license.expires_at else now() end;
      -- Clamp day-of-month to avoid overflow at the end of shorter months.
      v_expiry := date_trunc('month',v_base) + make_interval(months => v_months)
        + (least(extract(day from v_base)::int,
           extract(day from (date_trunc('month',v_base) + make_interval(months => v_months + 1) - interval '1 day'))::int) - 1) * interval '1 day'
        + (v_base - date_trunc('day',v_base));
    end if;
    insert into public.licenses(user_id,phone,activated_at,expires_at,active,note,updated_at)
      values(p_user_id,v_account.phone_e164,now(),v_expiry,true,'Phone account approved by admin',now())
      on conflict(user_id) do update set phone=excluded.phone, activated_at=excluded.activated_at,
        expires_at=excluded.expires_at,active=true,note=excluded.note,updated_at=now();
  else
    update public.licenses set active=false,updated_at=now() where user_id=p_user_id;
    v_expiry := null;
  end if;
  v_status := case p_action when 'approve' then 'approved' when 'deny' then 'denied' else 'revoked' end;
  update public.phone_auth_accounts set status=v_status,
    approved_by=case when p_action='approve' then p_admin_id else null end,
    approved_at=case when p_action='approve' then now() else null end,
    updated_at=now() where user_id=p_user_id;
  insert into public.phone_auth_audit(user_id,phone_e164,actor_id,action,term)
    values(p_user_id,v_account.phone_e164,p_admin_id,p_action,
      case when p_action='approve' then p_term else null end);
  return jsonb_build_object('success',true,'status',v_status,'expires_at',v_expiry);
end;
$function$;
revoke all on function public.phone_auth_admin_transition(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.phone_auth_admin_transition(uuid,uuid,text,text) to service_role;
