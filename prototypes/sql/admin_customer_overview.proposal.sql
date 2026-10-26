-- DESIGN PROPOSAL ONLY. Do not execute against production without approval.
-- One owner, two existing admin logins. Both remain distinct auth.users rows.
-- The function intentionally returns no API keys, password hashes, PINs,
-- tokens, Telegram messages, or private customer calculation data.

create or replace function public.admin_customer_overview()
returns table (
  account_kind text,
  user_id uuid,
  email text,
  license_active boolean,
  expires_at timestamptz,
  device_count bigint,
  last_seen timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  ) then
    raise exception 'Không có quyền Admin' using errcode = '42501';
  end if;

  return query
  with device_totals as (
    select d.user_id, count(*) filter (where d.active) as active_devices,
           max(d.last_seen) as last_device_seen
    from public.devices d group by d.user_id
  )
  select 'registered'::text, u.id, u.email::text,
         l.active, l.expires_at,
         coalesce(dt.active_devices, 0), dt.last_device_seen
  from auth.users u
  left join public.email_licenses l on l.user_id = u.id
  left join device_totals dt on dt.user_id = u.id
  -- The owner's two admin logins are not paying customer records.
  where not exists (
    select 1 from public.admin_users a where a.user_id = u.id
  )
    and not exists (
      select 1 from public.profiles p
      where p.id = u.id and p.role = 'admin'
    )
  union all
  select 'pending'::text, null::uuid, p.email::text,
         p.active, p.expires_at, 0::bigint, null::timestamptz
  from public.pending_email_licenses p
  where not exists (
    select 1 from auth.users u where lower(u.email) = lower(p.email)
  );
end;
$function$;

-- The owner must explicitly approve deployment and privilege changes.
-- Intended final grants, after reviewing existing grants and dependencies:
-- revoke all on function public.admin_customer_overview() from public, anon;
-- grant execute on function public.admin_customer_overview() to authenticated;
