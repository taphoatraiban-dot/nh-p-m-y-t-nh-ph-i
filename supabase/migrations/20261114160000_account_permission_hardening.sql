-- DRAFT: validate in staging before production. No customer, price, or license rewrites.
begin;
-- Defense in depth: API callers cannot edit their own authority, even if UPDATE
-- permissions are broadened later. Trusted definer RPCs still perform Admin checks.
create schema if not exists cuncun_private;
revoke all on schema cuncun_private from public, anon, authenticated;
create or replace function cuncun_private.guard_profile_authority()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user in ('anon','authenticated') then
    if tg_op='INSERT' then
      if coalesce(new.role,'')='admin' or coalesce(new.edition,'standard')<>'standard' then
        raise exception 'Không được tự cấp quyền' using errcode='42501';
      end if;
    elsif new.role is distinct from old.role or new.edition is distinct from old.edition or new.id is distinct from old.id then
      raise exception 'Không được tự đổi quyền' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function cuncun_private.guard_profile_authority() from public,anon,authenticated;
create trigger cuncun_profile_authority before insert or update on public.profiles
for each row execute function cuncun_private.guard_profile_authority();
revoke all on public.admin_users from anon,authenticated;
grant select on public.admin_users to authenticated;
revoke update(role,edition), insert(role,edition) on public.profiles from anon,authenticated;
create or replace function public.check_email_license()
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_email text;
  v_role text;
  v_edition text;
  v_license record;
begin
  select email into v_email from auth.users where id = auth.uid();
  select role, coalesce(edition, 'standard') into v_role, v_edition
    from public.profiles where id = auth.uid();
  v_edition := coalesce(v_edition, 'standard');

  -- Canonical membership is shared with all Admin RPCs. No profile/metadata promotion.
  if auth.uid() is not null and exists (select 1 from public.admin_users where user_id=auth.uid()) then
    return json_build_object('success',true,'active',true,'is_admin',true,
      'email',v_email,'expires_at',null,'edition','pro','message','Admin');
  end if;

  -- Phone identities must use phone approval and license only, never email licenses.
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


-- Reports are transient projections of the caller's already calculated rows.
-- Monetary calculation stays in the existing engine; no writes or customer lookup.
create or replace function public.pro_calculation_report(p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  permission jsonb;
  summaries jsonb;
  tops jsonb;
begin
  permission:=public.check_email_license()::jsonb;
  if auth.uid() is null or permission->>'success' is distinct from 'true' or permission->>'active' is distinct from 'true'
    or not (coalesce(permission->>'is_admin','false')='true' or coalesce(permission->>'edition','standard')='pro') then
    raise exception 'Yêu cầu phiên bản PRO' using errcode='42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then
    raise exception 'Invalid report rows' using errcode='22023';
  end if;
  if jsonb_array_length(p_rows)>20000 or octet_length(p_rows::text)>8000000 then
    raise exception 'Report too large' using errcode='22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_rows) r where
    jsonb_typeof(r)<>'object' or coalesce(r->>'region','') not in ('N','T','B') or
    coalesce(length(r->>'type'),0) not between 1 and 80 or
    jsonb_typeof(r->'numbers') is distinct from 'array' or
    jsonb_typeof(r->'gross') is distinct from 'number' or
    jsonb_typeof(r->'points') is distinct from 'number' or
    jsonb_typeof(r->'win') is distinct from 'number' or
    jsonb_typeof(r->'thu') is distinct from 'number') then
    raise exception 'Invalid report row' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r where jsonb_array_length(r->'numbers') not between 1 and 1000) then
    raise exception 'Invalid number count' using errcode='22023';
  end if;
  if (select sum(jsonb_array_length(r->'numbers')) from jsonb_array_elements(p_rows) r)>100000 then
    raise exception 'Report too large' using errcode='22023';
  end if;
  with rows as (
    select r->>'region' region,r->>'type' type,(r->>'gross')::double precision gross,
      (r->>'win')::double precision win,(r->>'thu')::double precision thu,i
    from jsonb_array_elements(p_rows) with ordinality x(r,i)
  ), grouped as (
    select region,type,sum(gross order by i) gross,sum(win order by i) win,sum(thu order by i) thu,min(i) first_seen
    from rows group by region,type
  ) select coalesce(jsonb_agg(to_jsonb(g)-'first_seen' order by first_seen),'[]'::jsonb) into summaries from grouped g;
  with expanded as (
    select r->>'region' region,r->>'type' type,n #>> '{}' num,
      (r->>'gross')::double precision/jsonb_array_length(r->'numbers') gross,
      (r->>'points')::double precision points,i,j
    from jsonb_array_elements(p_rows) with ordinality x(r,i)
    cross join lateral jsonb_array_elements(r->'numbers') with ordinality y(n,j)
  ), grouped as (
    select region,type,num,sum(gross order by i,j) gross,sum(points order by i,j) points,min(i*1001+j) first_seen
    from expanded group by region,type,num
  ), ranked as (
    select *,row_number() over(partition by region,type order by gross desc,points desc,first_seen) rank from grouped
  ), typed as (
    select region,type,jsonb_agg(jsonb_build_object('num',num,'gross',gross) order by rank) items,min(first_seen) first_seen
    from ranked where rank<=10 group by region,type
  ) select coalesce(jsonb_agg(to_jsonb(t)-'first_seen' order by first_seen),'[]'::jsonb) into tops from typed t;
  return jsonb_build_object('summary',summaries,'top10',tops);
end $$;
revoke all on function public.pro_calculation_report(jsonb) from public,anon;
grant execute on function public.pro_calculation_report(jsonb) to authenticated;
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
    select 1 from public.admin_users a where a.user_id = auth.uid()
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

CREATE OR REPLACE FUNCTION public.admin_list_devices()
 RETURNS TABLE(user_id uuid, email text, device_id text, device_name text, active boolean, first_seen timestamp with time zone, last_seen timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin

  -- Chỉ tài khoản Admin được phép gọi
  if not exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
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
    select 1 from public.admin_users a where a.user_id = auth.uid()
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
    select 1 from public.admin_users a where a.user_id = auth.uid()
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
    select 1 from public.admin_users a where a.user_id = auth.uid()
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
    select 1 from public.admin_users a where a.user_id = auth.uid()
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
create or replace function public.admin_list_device_editions()
returns table(user_id uuid, edition text)
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
    select d.user_id, coalesce(p.edition, 'standard')
    from public.devices d
    left join public.profiles p on p.id = d.user_id;
end;
$function$;

create or replace function public.admin_set_profile_edition(p_user_id uuid, p_edition text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
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

  if not exists (select 1 from auth.users where id=p_user_id) then
    return json_build_object('ok',false,'message','Không tìm thấy tài khoản.');
  end if;
  insert into public.profiles(id,role,edition) values(p_user_id,'user',p_edition)
  on conflict(id) do update set edition=excluded.edition;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return json_build_object('ok', false, 'message', 'Không tìm thấy hồ sơ tài khoản.');
  end if;
  return json_build_object('ok', true, 'user_id', p_user_id, 'edition', p_edition);
end;
$function$;

revoke all on function public.admin_list_device_editions() from public, anon;
revoke all on function public.admin_set_profile_edition(uuid, text) from public, anon;
grant execute on function public.admin_list_device_editions() to authenticated;
grant execute on function public.admin_set_profile_edition(uuid, text) to authenticated;

commit;
