-- STAGING ONLY. Apply after 202611020001_phone_auth_accounts.sql.
-- Atomic license/status/audit update; called with service-role only.
create or replace function public.phone_auth_admin_change(
 p_admin_id uuid, p_user_id uuid, p_action text, p_term text default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_phone text; v_status text; v_expiry timestamptz; v_old_active boolean := false; v_old_expiry timestamptz := null; v_old_exists boolean := false; v_months integer; v_base timestamptz;
begin
 if not exists (select 1 from public.admin_users where user_id=p_admin_id) then
   raise exception 'ADMIN_REQUIRED';
 end if;
 if p_action not in ('approve','deny','revoke') then raise exception 'INVALID_ACTION'; end if;
 select phone_e164 into v_phone from public.phone_auth_accounts where user_id=p_user_id for update;
 if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
 if p_action='approve' then
   if p_term not in ('1m','3m','12m','permanent') or p_term is null then raise exception 'INVALID_TERM'; end if;
   select active,expires_at into v_old_active,v_old_expiry from public.licenses where user_id=p_user_id for update;
   v_old_exists := found;
   if p_term='permanent' or (v_old_exists and v_old_active and v_old_expiry is null) then
     v_expiry:=null;
   else
     v_months:=case p_term when '1m' then 1 when '3m' then 3 when '12m' then 12 end;
     v_base:=case when v_old_exists and v_old_active and v_old_expiry>now() then v_old_expiry else now() end;
     -- Clamp to the last day of the target month (e.g. Jan 31 + 1m -> Feb 28/29).
     v_expiry:= (date_trunc('month',v_base) + make_interval(months=>v_months))
       + (least(extract(day from v_base)::integer,
           extract(day from (date_trunc('month',v_base) + make_interval(months=>v_months+1) - interval '1 day'))::integer)-1) * interval '1 day'
       + (v_base-date_trunc('day',v_base));
   end if;
   insert into public.licenses(user_id,phone,activated_at,expires_at,active,note,updated_at)
   values(p_user_id,v_phone,now(),v_expiry,true,'Phone account approved by admin',now())
   on conflict(user_id) do update set phone=excluded.phone,expires_at=excluded.expires_at,active=true,
     note=excluded.note,updated_at=now();
   v_status:='approved';
 else
   update public.licenses set active=false,updated_at=now() where user_id=p_user_id;
   v_status:=case when p_action='deny' then 'denied' else 'revoked' end;
 end if;
 update public.phone_auth_accounts set status=v_status,approved_by=case when p_action='approve' then p_admin_id else null end,
 approved_at=case when p_action='approve' then now() else null end,updated_at=now() where user_id=p_user_id;
 insert into public.phone_auth_audit(user_id,phone_e164,actor_id,action,term)
 values(p_user_id,v_phone,p_admin_id,p_action,case when p_action='approve' then p_term else null end);
 return jsonb_build_object('success',true,'status',v_status,'expires_at',v_expiry);
end;
$$;
revoke all on function public.phone_auth_admin_change(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.phone_auth_admin_change(uuid,uuid,text,text) to service_role;
