-- STAGED ONLY. Read-only commercial order list for authenticated admins.
-- Existing licenses, devices and memberships remain untouched.
create or replace function public.ott_admin_list_commercial_orders(p_limit integer default 50)
returns table (
 id uuid, customer_user_id uuid, plan_code text, duration_months integer,
 amount_vnd bigint, status text, payment_reference text,
 created_at timestamptz, confirmed_at timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists(
   select 1 from public.admin_users where user_id=auth.uid()
 ) then raise exception 'Admin permission required' using errcode='42501'; end if;
 if p_limit is null or p_limit < 1 or p_limit > 100 then
   raise exception 'Invalid limit'; end if;
 return query select o.id,o.customer_user_id,o.plan_code,o.duration_months,
   o.amount_vnd,o.status,o.payment_reference,o.created_at,o.confirmed_at
   from public.ott_commercial_orders o
   order by o.created_at desc,o.id desc limit p_limit;
end $$;
revoke all on function public.ott_admin_list_commercial_orders(integer) from public,anon;
grant execute on function public.ott_admin_list_commercial_orders(integer) to authenticated;
