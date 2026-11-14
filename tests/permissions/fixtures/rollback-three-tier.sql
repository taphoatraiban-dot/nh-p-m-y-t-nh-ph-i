-- Restores only the objects changed by the three-tier migration. No account data writes.
BEGIN;
DROP TRIGGER IF EXISTS cuncun_profile_authority ON public.profiles;
DROP FUNCTION IF EXISTS cuncun_private.guard_profile_authority();
DROP FUNCTION IF EXISTS public.pro_calculation_report(jsonb);
CREATE OR REPLACE FUNCTION public.admin_activate_license(p_user_id uuid, p_phone text, p_days integer DEFAULT 30, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  old_exp timestamptz;
  new_exp timestamptz;
begin

  if not exists (
    select 1
    from public.profiles
    where id=auth.uid()
      and role='admin'
  ) then
    return jsonb_build_object(
      'ok',false,
      'message','Không có quyền admin.'
    );
  end if;

  select expires_at
  into old_exp
  from public.licenses
  where user_id=p_user_id;

  if old_exp is not null and old_exp > now() then
    new_exp := old_exp
      + make_interval(days => greatest(1,p_days));
  else
    new_exp := now()
      + make_interval(days => greatest(1,p_days));
  end if;

  insert into public.licenses (
    user_id,
    phone,
    activated_at,
    expires_at,
    active,
    note,
    updated_at
  )
  values (
    p_user_id,
    p_phone,
    now(),
    new_exp,
    true,
    p_note,
    now()
  )
  on conflict(user_id)
  do update set
    phone=excluded.phone,
    activated_at=now(),
    expires_at=excluded.expires_at,
    active=true,
    note=excluded.note,
    updated_at=now();

  return jsonb_build_object(
    'ok',true,
    'expires_at',new_exp,
    'message','Đã kích hoạt/gia hạn.'
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.admin_list_device_editions()
 RETURNS TABLE(user_id uuid, edition text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  ) then
    raise exception 'Không có quyền Admin' using errcode = '42501';
  end if;
  return query
    select d.user_id, coalesce(p.edition, 'pro')
    from public.devices d
    left join public.profiles p on p.id = d.user_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.admin_list_devices()
 RETURNS TABLE(user_id uuid, email text, device_id text, device_name text, active boolean, first_seen timestamp with time zone, last_seen timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin

  -- Chỉ tài khoản Admin được phép gọi
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'Không có quyền Admin.';
  end if;

  return query
  select
    d.user_id,
    u.email::text,
    d.device_id,
    d.device_name,
    d.active,
    d.first_seen,
    d.last_seen
  from public.devices d
  join auth.users u
    on u.id = d.user_id
  order by d.last_seen desc;

end;
$function$;
CREATE OR REPLACE FUNCTION public.admin_reserve_customer(p_days integer, p_note text, p_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_phone text;
  v_expires timestamptz;
begin

  -- Kiểm tra tài khoản hiện tại có role ADMIN
  if not exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'Không có quyền Admin';
  end if;

  v_phone := regexp_replace(trim(p_phone), '[^0-9+]', '', 'g');

  if v_phone = '' then
    raise exception 'Thiếu số điện thoại';
  end if;

  if p_days is null or p_days <= 0 then
    raise exception 'Số ngày phải lớn hơn 0';
  end if;

  v_expires := now() + make_interval(days => p_days);

  update public.pending_customer_licenses
  set
    activated_at = now(),
    expires_at = v_expires,
    active = true,
    note = p_note,
    updated_at = now()
  where phone = v_phone;

  if not found then
    insert into public.pending_customer_licenses
      (phone, activated_at, expires_at, active, note, updated_at)
    values
      (v_phone, now(), v_expires, true, p_note, now());
  end if;

  return jsonb_build_object(
    'ok', true,
    'phone', v_phone,
    'expires_at', v_expires,
    'days', p_days
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.admin_reserve_email(p_email text, p_days integer DEFAULT 30, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := lower(trim(p_email));
  v_exp timestamptz;
  v_user_id uuid;
begin
  -- Kiểm tra Admin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    return jsonb_build_object(
      'ok', false,
      'message', 'Không có quyền Admin.'
    );
  end if;

  -- Kiểm tra email
  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object(
      'ok', false,
      'message', 'Email không hợp lệ.'
    );
  end if;

  -- Kiểm tra số ngày
  if p_days is null or p_days <= 0 then
    return jsonb_build_object(
      'ok', false,
      'message', 'Số ngày phải lớn hơn 0.'
    );
  end if;

  v_exp := now() + make_interval(days => p_days);

  -- Tìm tài khoản đã tồn tại
  select id
  into v_user_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  -- Nếu khách đã có tài khoản -> cấp trực tiếp
  if v_user_id is not null then

    insert into public.email_licenses
      (user_id,email,activated_at,expires_at,active,note,created_at,updated_at)
    values
      (v_user_id,v_email,now(),v_exp,true,p_note,now(),now())
    on conflict(user_id) do update set
      email = excluded.email,
      activated_at = excluded.activated_at,
      expires_at = excluded.expires_at,
      active = true,
      note = excluded.note,
      updated_at = now();

    return jsonb_build_object(
      'ok', true,
      'email', v_email,
      'expires_at', v_exp,
      'days', p_days,
      'existing_user', true
    );

  else

    -- Chưa có tài khoản -> lưu chờ đăng ký
    insert into public.pending_email_licenses
      (email,activated_at,expires_at,active,note,updated_at)
    values
      (v_email,now(),v_exp,true,p_note,now())
    on conflict(email) do update set
      activated_at = now(),
      expires_at = excluded.expires_at,
      active = true,
      note = excluded.note,
      updated_at = now();

    return jsonb_build_object(
      'ok', true,
      'email', v_email,
      'expires_at', v_exp,
      'days', p_days,
      'existing_user', false
    );

  end if;
end;
$function$;
CREATE OR REPLACE FUNCTION public.admin_reset_device(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin

  if not exists (
    select 1
    from public.profiles
    where id=auth.uid()
    and role='admin'
  ) then

    return jsonb_build_object(
      'ok',false,
      'message','Không có quyền admin.'
    );

  end if;

  delete from public.devices
  where user_id=p_user_id;

  return jsonb_build_object(
    'ok',true,
    'message','Đã reset.'
  );

end;
$function$;
CREATE OR REPLACE FUNCTION public.admin_set_license_active(p_user_id uuid, p_active boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin

  if not exists (
    select 1
    from public.profiles
    where id=auth.uid()
      and role='admin'
  ) then
    return jsonb_build_object(
      'ok',false,
      'message','Không có quyền admin.'
    );
  end if;

  update public.licenses
  set
    active=p_active,
    updated_at=now()
  where user_id=p_user_id;

  return jsonb_build_object(
    'ok',true,
    'active',p_active
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.admin_set_profile_edition(p_user_id uuid, p_edition text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rows integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  ) then
    raise exception 'Không có quyền Admin' using errcode = '42501';
  end if;
  if p_edition is null or p_edition not in ('standard', 'pro') then
    return json_build_object('ok', false, 'message', 'Phiên bản không hợp lệ.');
  end if;
  if exists (select 1 from public.admin_users a where a.user_id = p_user_id) then
    return json_build_object('ok', false, 'message', 'Tài khoản Admin luôn dùng phiên bản Pro.');
  end if;

  update public.profiles set edition = p_edition where id = p_user_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return json_build_object('ok', false, 'message', 'Không tìm thấy hồ sơ tài khoản.');
  end if;
  return json_build_object('ok', true, 'user_id', p_user_id, 'edition', p_edition);
end;
$function$;
CREATE OR REPLACE FUNCTION public.check_email_license()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_role text;
  v_edition text;
  v_license record;
begin
  select email into v_email from auth.users where id = auth.uid();
  select role, coalesce(edition, 'pro') into v_role, v_edition
    from public.profiles where id = auth.uid();
  v_edition := coalesce(v_edition, 'pro');

  if not exists (select 1 from auth.users u where u.id = auth.uid() and (u.email like 'phone-%@accounts.invalid' or u.raw_app_meta_data->>'cuncun_auth_type' = 'phone_password'))
     and v_role = 'admin' then
    return json_build_object('success',true,'active',true,'is_admin',true,
      'email',v_email,'expires_at',null,'edition','pro','message','Admin');
  end if;

  if exists (select 1 from auth.users u where u.id = auth.uid() and (u.email like 'phone-%@accounts.invalid' or u.raw_app_meta_data->>'cuncun_auth_type' = 'phone_password')) then
    if exists (
      select 1 from public.phone_auth_accounts pa
      join public.licenses l on l.user_id = pa.user_id
      where pa.user_id = auth.uid() and pa.status = 'approved'
        and l.active = true and (l.expires_at is null or l.expires_at > now())
    ) then
      select l.expires_at into v_license from public.licenses l
      where l.user_id = auth.uid() and l.active = true
        and (l.expires_at is null or l.expires_at > now());
      return json_build_object('success',true,'active',true,'is_admin',false,
        'email',v_email,'expires_at',v_license.expires_at,'edition',v_edition,'message','Phone license còn hạn');
    end if;
    return json_build_object('success',false,'active',false,'is_admin',false,
      'email',v_email,'expires_at',null,'edition',v_edition,'message','Tài khoản SĐT chưa có bản quyền hợp lệ.');
  end if;

  select el.expires_at into v_license
  from public.email_licenses el
  where el.user_id = auth.uid() and el.active = true and el.expires_at > now();

  if found then
    return json_build_object('success',true,'active',true,'is_admin',false,
      'email',v_email,'expires_at',v_license.expires_at,'edition',v_edition,'message','License còn hạn');
  end if;

  if exists (
    select 1 from public.phone_auth_accounts pa
    join public.licenses l on l.user_id = pa.user_id
    where pa.user_id = auth.uid()
      and pa.status = 'approved'
      and l.active = true
      and (l.expires_at is null or l.expires_at > now())
  ) then
    select l.expires_at into v_license
    from public.licenses l where l.user_id = auth.uid() and l.active = true
      and (l.expires_at is null or l.expires_at > now());
    return json_build_object('success',true,'active',true,'is_admin',false,
      'email',v_email,'expires_at',v_license.expires_at,'edition',v_edition,'message','Phone license còn hạn');
  end if;

  return json_build_object('success',false,'active',false,'is_admin',false,
    'email',v_email,'expires_at',null,'edition',v_edition,'message','Tài khoản chưa có bản quyền.');
end;
$function$;
REVOKE ALL ON public.admin_users FROM anon,authenticated;
GRANT INSERT ON public.admin_users TO "anon";
GRANT SELECT ON public.admin_users TO "anon";
GRANT UPDATE ON public.admin_users TO "anon";
GRANT DELETE ON public.admin_users TO "anon";
GRANT TRUNCATE ON public.admin_users TO "anon";
GRANT REFERENCES ON public.admin_users TO "anon";
GRANT TRIGGER ON public.admin_users TO "anon";
GRANT INSERT ON public.admin_users TO "authenticated";
GRANT SELECT ON public.admin_users TO "authenticated";
GRANT UPDATE ON public.admin_users TO "authenticated";
GRANT DELETE ON public.admin_users TO "authenticated";
GRANT TRUNCATE ON public.admin_users TO "authenticated";
GRANT REFERENCES ON public.admin_users TO "authenticated";
GRANT TRIGGER ON public.admin_users TO "authenticated";
COMMIT;
