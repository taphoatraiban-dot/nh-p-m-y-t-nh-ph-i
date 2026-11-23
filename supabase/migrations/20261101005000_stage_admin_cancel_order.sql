-- Staged commercial-only cancellation. No license or device changes.
create or replace function public.ott_admin_cancel_commercial_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_changed integer;
begin
 if auth.uid() is null or not exists(
  select 1 from public.admin_users where user_id=auth.uid()
 ) then raise exception 'Admin permission required' using errcode='42501'; end if;
 update public.ott_commercial_orders
 set status='cancelled'
 where id=p_order_id and status='pending';
 get diagnostics v_changed=row_count;
 return v_changed=1;
end $$;
revoke all on function public.ott_admin_cancel_commercial_order(uuid) from public,anon;
grant execute on function public.ott_admin_cancel_commercial_order(uuid) to authenticated;
