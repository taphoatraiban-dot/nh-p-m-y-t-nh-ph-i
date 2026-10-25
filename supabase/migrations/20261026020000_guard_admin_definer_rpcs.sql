-- Require a server-side admin membership before privileged account actions.
-- Keep authenticated EXECUTE so the admin UI can continue calling these RPCs;
-- ordinary signed-in users are rejected inside each SECURITY DEFINER function.

CREATE OR REPLACE FUNCTION public.admin_set_license_paused(
  p_paused boolean,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  ) then
    raise exception 'Không có quyền Admin'
      using errcode = '42501';
  end if;

  -- Chỉ đóng/mở bản quyền
  -- KHÔNG đụng vào devices nên máy vẫn được giữ nguyên
  update public.email_licenses
  set active = not p_paused
  where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'paused', p_paused,
    'message',
      case
        when p_paused then 'Đã tạm ngưng quyền.'
        else 'Đã mở lại quyền.'
      end
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_maintenance(
  p_enabled boolean,
  p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  ) then
    raise exception 'Không có quyền Admin'
      using errcode = '42501';
  end if;

  update public.system_settings
  set
    maintenance = p_enabled,
    maintenance_message = coalesce(
      nullif(trim(p_message), ''),
      'Hệ thống đang bảo trì. Vui lòng quay lại sau.'
    ),
    updated_at = now()
  where id = 'main';

  return jsonb_build_object(
    'ok', true,
    'maintenance', p_enabled
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.approve_upgrade_request(p_request_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  v_user_id uuid;
  v_plan_code text;
  v_duration_months integer;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  ) then
    raise exception 'Không có quyền Admin'
      using errcode = '42501';
  end if;

  select user_id, plan_code, duration_months
  into v_user_id, v_plan_code, v_duration_months
  from public.upgrade_requests
  where id = p_request_id
    and status = 'pending';

  if v_user_id is null then
    raise exception 'Không tìm thấy đơn pending';
  end if;

  update public.user_api_keys
  set
    plan_code = v_plan_code,
    expires_at = greatest(coalesce(expires_at, now()), now())
      + make_interval(months => v_duration_months)
  where user_id = v_user_id
    and is_active = true;

  update public.upgrade_requests
  set
    status = 'approved',
    reviewed_at = now()
  where id = p_request_id;
end;
$function$;
