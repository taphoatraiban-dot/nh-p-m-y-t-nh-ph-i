-- Expose registered phone numbers to device management only through an Admin-checked RPC.
create or replace function public.admin_list_device_phone_numbers()
returns table(user_id uuid, phone_e164 text)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  ) then
    raise exception 'Không có quyền Admin' using errcode = '42501';
  end if;

  return query
    select pa.user_id, pa.phone_e164
    from public.phone_auth_accounts pa
    join public.devices d on d.user_id = pa.user_id
    where pa.phone_e164 is not null and btrim(pa.phone_e164) <> '';
end;
$function$;

revoke all on function public.admin_list_device_phone_numbers() from public, anon;
grant execute on function public.admin_list_device_phone_numbers() to authenticated;
