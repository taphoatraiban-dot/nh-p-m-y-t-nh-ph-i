-- Staging-only migration. Do not apply to production before device/session tests.
-- Admin membership is checked on the server; customers retain one-device binding.
CREATE OR REPLACE FUNCTION public.claim_device(p_device_id text, p_device_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  old_device text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('allowed',false,'message','Chưa đăng nhập.');
  END IF;

  IF nullif(btrim(p_device_id), '') IS NULL THEN
    RETURN jsonb_build_object('allowed',false,'message','Thiếu mã thiết bị.');
  END IF;

  -- No writes to the single-device customer table for admins.
  -- admin_users must be managed by trusted server-side admin operations only.
  IF EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = uid) THEN
    RETURN jsonb_build_object('allowed',true,'is_admin',true,
      'message','Thiết bị Admin hợp lệ.');
  END IF;

  SELECT d.device_id INTO old_device
  FROM public.devices d
  WHERE d.user_id = uid
  FOR UPDATE;

  IF old_device IS NULL THEN
    INSERT INTO public.devices(user_id,device_id,device_name)
    VALUES(uid,p_device_id,p_device_name);
    RETURN jsonb_build_object('allowed',true,'message','Thiết bị đã được kích hoạt.');
  END IF;

  IF old_device = p_device_id THEN
    UPDATE public.devices
    SET device_name=p_device_name,last_seen=now(),active=true
    WHERE user_id=uid;
    RETURN jsonb_build_object('allowed',true,'message','Thiết bị hợp lệ.');
  END IF;

  RETURN jsonb_build_object('allowed',false,
    'message','Tài khoản đã được kích hoạt trên một thiết bị khác.');
END;
$function$;
-- Preserve existing function EXECUTE grants; verify them in staging.
