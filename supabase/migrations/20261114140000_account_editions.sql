-- Account editions: existing accounts remain Pro; new profiles default to Standard.
alter table public.profiles
  add column if not exists edition text not null default 'standard';

alter table public.profiles
  drop constraint if exists profiles_edition_check;
alter table public.profiles
  add constraint profiles_edition_check check (edition in ('standard', 'pro'));

update public.profiles set edition = 'pro' where edition = 'standard';

create or replace function public.check_email_license()
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  -- A phone account must never gain admin privileges from a stale profile role.
  if not exists (select 1 from auth.users u where u.id = auth.uid() and (u.email like 'phone-%@accounts.invalid' or u.raw_app_meta_data->>'cuncun_auth_type' = 'phone_password'))
     and v_role = 'admin' then
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
    select d.user_id, coalesce(p.edition, 'pro')
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

  update public.profiles set edition = p_edition where id = p_user_id;
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
