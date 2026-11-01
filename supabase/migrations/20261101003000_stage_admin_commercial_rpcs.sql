-- STAGED ONLY: requires preceding ott_commercial_orders migration.
-- Admin-only server pricing. Does NOT touch licenses, devices, memberships or sessions.
create or replace function public.ott_admin_create_commercial_order(
 p_customer_user_id uuid, p_plan_code text, p_duration_months integer,
 p_payment_reference text default null, p_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_amount bigint; v_id uuid;
begin
 if auth.uid() is null or not exists (
   select 1 from public.admin_users where user_id=auth.uid()
 ) then raise exception 'Admin permission required' using errcode='42501'; end if;
 if p_customer_user_id is null or not exists (select 1 from auth.users where id=p_customer_user_id)
 then raise exception 'Unknown customer'; end if;
 if p_plan_code is distinct from 'WEB' then raise exception 'Plan not available for sale'; end if;
 v_amount := case p_duration_months
 when 1 then 799000 when 3 then 2290000 when 6 then 4390000 when 12 then 7990000
 else null end;
 if v_amount is null then raise exception 'Invalid duration'; end if;
 if length(coalesce(p_payment_reference,''))>120 or length(coalesce(p_notes,''))>1000
 then raise exception 'Field too long'; end if;
 insert into public.ott_commercial_orders(
 customer_user_id,plan_code,duration_months,amount_vnd,
 payment_reference,notes,created_by,status
 ) values (p_customer_user_id,p_plan_code,p_duration_months,v_amount,
 nullif(trim(p_payment_reference),''),p_notes,auth.uid(),'pending')
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.ott_admin_create_commercial_order(uuid,text,integer,text,text) from public,anon;
grant execute on function public.ott_admin_create_commercial_order(uuid,text,integer,text,text) to authenticated;

-- Confirmation only marks the commercial order paid; never activates a license.
create or replace function public.ott_admin_confirm_commercial_order(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_changed integer;
begin
 if auth.uid() is null or not exists (
   select 1 from public.admin_users where user_id=auth.uid()
 ) then raise exception 'Admin permission required' using errcode='42501'; end if;
 update public.ott_commercial_orders
 set status='confirmed',confirmed_by=auth.uid(),confirmed_at=now()
 where id=p_order_id and status='pending';
 get diagnostics v_changed=row_count;
 return v_changed=1;
end $$;
revoke all on function public.ott_admin_confirm_commercial_order(uuid) from public,anon;
grant execute on function public.ott_admin_confirm_commercial_order(uuid) to authenticated;
