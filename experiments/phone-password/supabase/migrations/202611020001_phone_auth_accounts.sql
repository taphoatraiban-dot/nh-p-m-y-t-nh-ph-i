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
-- Lifetime phone licenses require a nullable expiry; existing email licenses remain unchanged.\nalter table public.licenses alter column expires_at drop not null;\nalter table public.phone_auth_accounts enable row level security;
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

  if v_role = 'admin' then
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
