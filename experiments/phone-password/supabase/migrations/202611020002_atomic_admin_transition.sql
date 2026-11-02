-- Apply after the phone-auth base schema on a dedicated staging database.
-- This separate migration ensures the RPC is installed even if the original
-- phone-auth migration was applied before the atomic transition was added.
-- Do NOT apply to production without a staging E2E and rollback sign-off.

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
