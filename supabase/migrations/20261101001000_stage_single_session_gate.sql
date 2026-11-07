-- STAGED MIGRATION: do not run until production backup and integration review.
-- Uses authenticated Supabase session_id, not a client-controlled device_id.
-- This only gates routes that explicitly call subscription_session_is_current().
-- It DOES NOT revoke Supabase Auth tokens or protect legacy endpoints by itself.
create table if not exists public.ott_account_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  switched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.ott_account_session_switches (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_session_id uuid,
  new_session_id uuid not null,
  switched_at timestamptz not null default now()
);
create index if not exists ott_account_session_switches_recent
  on public.ott_account_session_switches(user_id, switched_at desc);
alter table public.ott_account_sessions enable row level security;
alter table public.ott_account_session_switches enable row level security;
revoke all on public.ott_account_sessions from anon, authenticated;
revoke all on public.ott_account_session_switches from anon, authenticated;

create or replace function public.subscription_claim_current_session()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sid uuid;
  v_previous uuid;
  v_count integer;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  begin
    v_sid := nullif(auth.jwt()->>'session_id','')::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid session claim' using errcode='28000';
  end;
  if v_sid is null or not exists (
    select 1 from auth.sessions s where s.id=v_sid and s.user_id=v_uid
  ) then
    raise exception 'Valid session required' using errcode='28000';
  end if;
  -- Serialize all claims for this account, including first claim.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 92871));
  select session_id into v_previous from public.ott_account_sessions where user_id=v_uid;
  if v_previous = v_sid then
    update public.ott_account_sessions set updated_at=now() where user_id=v_uid;
    return jsonb_build_object('ok',true,'changed',false);
  end if;
  select count(*) into v_count
    from public.ott_account_session_switches
    where user_id=v_uid and switched_at > now()-interval '30 days';
  if v_previous is not null and v_count >= 2 then
    return jsonb_build_object('ok',false,'reason','transfer_limit');
  end if;
  insert into public.ott_account_sessions(user_id,session_id,switched_at,updated_at)
  values(v_uid,v_sid,now(),now())
  on conflict(user_id) do update set session_id=excluded.session_id,
    switched_at=excluded.switched_at,updated_at=excluded.updated_at;
  if v_previous is not null then
    insert into public.ott_account_session_switches(user_id,previous_session_id,new_session_id)
    values(v_uid,v_previous,v_sid);
  end if;
  return jsonb_build_object('ok',true,'changed',v_previous is distinct from v_sid);
end;
$$;

create or replace function public.subscription_session_is_current()
returns boolean language plpgsql stable security definer set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_sid uuid;
begin
  if v_uid is null then return false; end if;
  begin
    v_sid := nullif(auth.jwt()->>'session_id','')::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if v_sid is null then return false; end if;
  return exists (
    select 1 from public.ott_account_sessions a
    join auth.sessions s on s.id=a.session_id and s.user_id=a.user_id
    where a.user_id=v_uid and a.session_id=v_sid
  );
end;
$$;
revoke all on function public.subscription_claim_current_session() from public,anon;
revoke all on function public.subscription_session_is_current() from public,anon;
grant execute on function public.subscription_claim_current_session() to authenticated;
grant execute on function public.subscription_session_is_current() to authenticated;
-- Critical: no existing RLS policy or endpoint is changed by this migration.
-- Admin recovery must be implemented separately with audited admin authorization.
