-- REVIEW ONLY. NEVER EXECUTE ON PRODUCTION WITHOUT SEPARATE APPROVAL.
-- This proposed migration must first be revised, rehearsed on isolated data,
-- backed up, reviewed for privileges, and packaged using the migration workflow.
-- Based on read-only schema inspection on 2026-10-26.

begin;

-- No changes to existing email_licenses/devices structure or existing RPCs.
create table public.admin_customer_revisions (
  user_id uuid primary key references auth.users(id),
  revision bigint not null default 0 check (revision >= 0)
);

create table public.admin_customer_commands (
  request_id uuid primary key,
  actor_id uuid not null references auth.users(id),
  user_id uuid not null references auth.users(id),
  action text not null check (action in ('extend','pause','resume','reset_device')),
  days integer,
  reason text not null,
  expected_revision bigint not null,
  result_revision bigint,
  created_at timestamptz not null default now()
);
create index admin_customer_commands_user_created_idx
  on public.admin_customer_commands(user_id, created_at desc);

-- Preserve a device snapshot before clearing the current binding. Existing
-- claim_device requires absence of a devices row to allow a different device.
create table public.admin_device_reset_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.admin_customer_commands(request_id),
  user_id uuid not null references auth.users(id),
  device_id text not null,
  device_name text,
  active boolean not null,
  first_seen timestamptz not null,
  last_seen timestamptz not null,
  archived_at timestamptz not null default now()
);
create index admin_device_reset_history_user_idx
  on public.admin_device_reset_history(user_id, archived_at desc);

alter table public.admin_customer_revisions enable row level security;
alter table public.admin_customer_commands enable row level security;
alter table public.admin_device_reset_history enable row level security;
-- No direct Data API policies: access only via audited server RPC.
revoke all on public.admin_customer_revisions from public, anon, authenticated;
revoke all on public.admin_customer_commands from public, anon, authenticated;
revoke all on public.admin_device_reset_history from public, anon, authenticated;
revoke all on sequence public.admin_device_reset_history_id_seq from public, anon, authenticated;

create function public.admin_customer_command(
  p_request_id uuid,
  p_action text,
  p_user_id uuid,
  p_expected_revision bigint,
  p_days integer,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
set timezone = 'UTC'
as $function$
declare
  v_actor uuid := auth.uid();
  v_claimed uuid;
  v_existing public.admin_customer_commands%rowtype;
  v_revision bigint;
  v_expiry timestamptz;
begin
  if v_actor is null or not exists (
    select 1 from public.admin_users where user_id = v_actor
  ) then
    raise exception 'Không có quyền quản trị' using errcode = '42501';
  end if;
  if p_request_id is null or p_user_id is null or p_action is null or p_expected_revision is null
     or p_expected_revision < 0 or p_action not in ('extend','pause','resume','reset_device')
     or length(btrim(coalesce(p_reason,''))) not between 10 and 500
     or (p_action = 'extend' and (p_days is null or p_days not between 1 and 365))
     or (p_action <> 'extend' and p_days is not null) then
    raise exception 'Yêu cầu không hợp lệ' using errcode = '22023';
  end if;
  if exists (select 1 from public.admin_users where user_id = p_user_id)
     or exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then
    raise exception 'Không thao tác trên tài khoản Admin' using errcode = '42501';
  end if;

  -- Unique request ID is claimed inside the same transaction as the mutation.
  -- An in-flight duplicate waits for the first transaction to complete.
  insert into public.admin_customer_commands(
    request_id,actor_id,user_id,action,days,reason,expected_revision
  ) values (
    p_request_id,v_actor,p_user_id,p_action,p_days,btrim(p_reason),p_expected_revision
  ) on conflict (request_id) do nothing returning request_id into v_claimed;

  if v_claimed is null then
    select * into strict v_existing from public.admin_customer_commands
    where request_id = p_request_id;
    if v_existing.actor_id is distinct from v_actor
       or v_existing.user_id is distinct from p_user_id
       or v_existing.action is distinct from p_action
       or v_existing.days is distinct from p_days
       or v_existing.reason is distinct from btrim(p_reason)
       or v_existing.expected_revision is distinct from p_expected_revision then
      raise exception 'Trùng mã yêu cầu với nội dung khác' using errcode = '23505';
    end if;
    return jsonb_build_object('success',true,'revision',v_existing.result_revision);
  end if;

  insert into public.admin_customer_revisions(user_id,revision)
  values (p_user_id,0) on conflict (user_id) do nothing;
  select revision into strict v_revision from public.admin_customer_revisions
  where user_id = p_user_id for update;
  if v_revision <> p_expected_revision then
    raise exception 'Dữ liệu đã thay đổi; tải lại trước khi thao tác' using errcode = '40001';
  end if;
  select expires_at into v_expiry from public.email_licenses
  where user_id = p_user_id for update;
  if not found then
    raise exception 'Không tìm thấy giấy phép đã đăng ký' using errcode = 'P0002';
  end if;

  if p_action = 'extend' then
    update public.email_licenses
      set expires_at = greatest(v_expiry, now()) + (p_days * interval '1 day'),
          updated_at = now()
      where user_id = p_user_id;
  elsif p_action in ('pause','resume') then
    update public.email_licenses
      set active = (p_action = 'resume'), updated_at = now()
      where user_id = p_user_id;
  elsif p_action = 'reset_device' then
    insert into public.admin_device_reset_history(
      request_id,user_id,device_id,device_name,active,first_seen,last_seen
    )
    select p_request_id,user_id,device_id,device_name,active,first_seen,last_seen
      from public.devices where user_id = p_user_id for update;
    delete from public.devices where user_id = p_user_id;
  end if;

  update public.admin_customer_revisions set revision = revision + 1
  where user_id = p_user_id;
  update public.admin_customer_commands set result_revision = v_revision + 1
  where request_id = p_request_id;
  return jsonb_build_object('success',true,'revision',v_revision + 1);
end;
$function$;

revoke all on function public.admin_customer_command(uuid,text,uuid,bigint,integer,text)
  from public, anon, authenticated;
grant execute on function public.admin_customer_command(uuid,text,uuid,bigint,integer,text)
  to authenticated;

-- Safety catch: a direct accidental run of this REVIEW file saves nothing.
-- A separately reviewed deployment migration would replace this with COMMIT.
rollback;
