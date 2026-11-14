create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
create table public."admin_users"("user_id" uuid not null,"created_at" timestamp with time zone default now() not null);
create table public."devices"("user_id" uuid not null,"device_id" text not null,"device_name" text,"active" boolean default true not null,"first_seen" timestamp with time zone default now() not null,"last_seen" timestamp with time zone default now() not null);
create table public."email_licenses"("user_id" uuid not null,"email" text not null,"activated_at" timestamp with time zone default now() not null,"expires_at" timestamp with time zone not null,"active" boolean default true not null,"note" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);
create table public."licenses"("user_id" uuid not null,"phone" text,"activated_at" timestamp with time zone default now() not null,"expires_at" timestamp with time zone,"active" boolean default true not null,"note" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);
create table public."pending_customer_licenses"("phone" text not null,"activated_at" timestamp with time zone default now() not null,"expires_at" timestamp with time zone not null,"active" boolean default true not null,"note" text,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);
create table public."pending_email_licenses"("email" text not null,"activated_at" timestamp with time zone default now() not null,"expires_at" timestamp with time zone not null,"active" boolean default true not null,"note" text,"updated_at" timestamp with time zone default now() not null);
create table public."phone_auth_accounts"("user_id" uuid not null,"phone_e164" text not null,"status" text default 'pending'::text not null,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"approved_by" uuid,"approved_at" timestamp with time zone);
create table public."profiles"("id" uuid not null,"role" text default 'user'::text not null,"created_at" timestamp with time zone default now() not null,"display_name" text,"edition" text default 'standard'::text not null);
create table public."system_settings"("id" text not null,"maintenance" boolean default false not null,"maintenance_message" text default 'Hệ thống đang bảo trì. Vui lòng quay lại sau.'::text not null,"updated_at" timestamp with time zone default now() not null);
alter table public."admin_users" add constraint "admin_users_pkey" PRIMARY KEY (user_id);
alter table public."admin_users" enable row level security;
alter table public."devices" add constraint "devices_pkey" PRIMARY KEY (user_id);
alter table public."devices" add constraint "devices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."devices" enable row level security;
alter table public."email_licenses" add constraint "email_licenses_email_key" UNIQUE (email);
alter table public."email_licenses" add constraint "email_licenses_pkey" PRIMARY KEY (user_id);
alter table public."email_licenses" add constraint "email_licenses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."email_licenses" enable row level security;
alter table public."licenses" add constraint "licenses_pkey" PRIMARY KEY (user_id);
alter table public."licenses" add constraint "licenses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."licenses" enable row level security;
alter table public."pending_customer_licenses" add constraint "pending_customer_licenses_pkey" PRIMARY KEY (phone);
alter table public."pending_customer_licenses" enable row level security;
alter table public."pending_email_licenses" add constraint "pending_email_licenses_pkey" PRIMARY KEY (email);
alter table public."pending_email_licenses" enable row level security;
alter table public."phone_auth_accounts" add constraint "phone_auth_accounts_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES auth.users(id);
alter table public."phone_auth_accounts" add constraint "phone_auth_accounts_phone_e164_key" UNIQUE (phone_e164);
alter table public."phone_auth_accounts" add constraint "phone_auth_accounts_pkey" PRIMARY KEY (user_id);
alter table public."phone_auth_accounts" add constraint "phone_auth_accounts_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'revoked'::text])));
alter table public."phone_auth_accounts" add constraint "phone_auth_accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."phone_auth_accounts" enable row level security;
alter table public."profiles" add constraint "profiles_edition_check" CHECK ((edition = ANY (ARRAY['standard'::text, 'pro'::text])));
alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])));
alter table public."profiles" enable row level security;
alter table public."system_settings" add constraint "system_settings_pkey" PRIMARY KEY (id);
alter table public."system_settings" enable row level security;
CREATE OR REPLACE FUNCTION public.admin_list_admin_device_user_ids()
 RETURNS TABLE(user_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not exists(select 1 from public.admin_users a where a.user_id=auth.uid()) then
  raise exception 'Không có quyền Admin' using errcode='42501';
 end if;
 return query select distinct a.user_id from public.admin_users a where a.user_id is not null;
end $function$;
revoke all on function public.admin_list_admin_device_user_ids() from public;
grant execute on function public.admin_list_admin_device_user_ids() to "postgres";
grant execute on function public.admin_list_admin_device_user_ids() to "authenticated";
grant execute on function public.admin_list_admin_device_user_ids() to "service_role";
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
revoke all on function public.admin_list_device_editions() from public;
grant execute on function public.admin_list_device_editions() to "postgres";
grant execute on function public.admin_list_device_editions() to "authenticated";
grant execute on function public.admin_list_device_editions() to "service_role";
CREATE OR REPLACE FUNCTION public.admin_list_device_phone_numbers()
 RETURNS TABLE(user_id uuid, phone_e164 text)
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
    select pa.user_id, pa.phone_e164
    from public.phone_auth_accounts pa
    join public.devices d on d.user_id = pa.user_id
    where pa.phone_e164 is not null and btrim(pa.phone_e164) <> '';
end;
$function$;
revoke all on function public.admin_list_device_phone_numbers() from public;
grant execute on function public.admin_list_device_phone_numbers() to "postgres";
grant execute on function public.admin_list_device_phone_numbers() to "authenticated";
grant execute on function public.admin_list_device_phone_numbers() to "service_role";
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
revoke all on function public.admin_list_devices() from public;
grant execute on function public.admin_list_devices() to "postgres";
grant execute on function public.admin_list_devices() to "authenticated";
grant execute on function public.admin_list_devices() to "service_role";
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
revoke all on function public.admin_set_profile_edition(uuid,text) from public;
grant execute on function public.admin_set_profile_edition(uuid,text) to "postgres";
grant execute on function public.admin_set_profile_edition(uuid,text) to "authenticated";
grant execute on function public.admin_set_profile_edition(uuid,text) to "service_role";
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
revoke all on function public.check_email_license() from public;
grant execute on function public.check_email_license() to "postgres";
grant execute on function public.check_email_license() to "authenticated";
grant execute on function public.check_email_license() to "service_role";
CREATE OR REPLACE FUNCTION public.phone_auth_has_active_license(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select p_user_id is not null and p_user_id = (select auth.uid()) and exists (select 1 from public.phone_auth_accounts a join public.licenses l on l.user_id = a.user_id where a.user_id = p_user_id and a.status = 'approved' and l.active is true and (l.expires_at is null or l.expires_at > now())); $function$;
revoke all on function public.phone_auth_has_active_license(uuid) from public;
grant execute on function public.phone_auth_has_active_license(uuid) to "postgres";
grant execute on function public.phone_auth_has_active_license(uuid) to "authenticated";
grant execute on function public.phone_auth_has_active_license(uuid) to "service_role";
CREATE OR REPLACE FUNCTION public.phone_auth_session_allowed()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select (select auth.uid()) is not null and (not exists (select 1 from auth.users u where u.id = (select auth.uid()) and (u.email like 'phone-%@accounts.invalid' or u.raw_app_meta_data->>'cuncun_auth_type' = 'phone_password' or u.raw_user_meta_data->>'auth_method' = 'phone_alias')) or public.phone_auth_has_active_license((select auth.uid()))); $function$;
revoke all on function public.phone_auth_session_allowed() from public;
grant execute on function public.phone_auth_session_allowed() to "postgres";
grant execute on function public.phone_auth_session_allowed() to "authenticated";
grant execute on function public.phone_auth_session_allowed() to "service_role";
create policy "Admin can read own admin row" on public."admin_users" as PERMISSIVE for SELECT to "authenticated" using ((auth.uid() = user_id));
create policy "devices_self" on public."devices" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = user_id));
create policy "phone_license_guard" on public."devices" as RESTRICTIVE for ALL to "authenticated" using (( SELECT phone_auth_session_allowed() AS phone_auth_session_allowed)) with check (( SELECT phone_auth_session_allowed() AS phone_auth_session_allowed));
create policy "licenses_self" on public."licenses" as PERMISSIVE for SELECT to "authenticated" using (((( SELECT auth.uid() AS uid) = user_id) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text))))));
create policy "profiles public read" on public."profiles" as PERMISSIVE for SELECT to public using (true);
create policy "profiles_self" on public."profiles" as PERMISSIVE for SELECT to "authenticated" using ((( SELECT auth.uid() AS uid) = id));
create policy "users update own profile" on public."profiles" as PERMISSIVE for UPDATE to public using ((auth.uid() = id)) with check ((auth.uid() = id));
create policy "system_settings_read" on public."system_settings" as PERMISSIVE for SELECT to "authenticated" using (true);
grant INSERT on public."licenses" to "service_role";
grant SELECT on public."licenses" to "service_role";
grant UPDATE on public."licenses" to "service_role";
grant DELETE on public."licenses" to "service_role";
grant TRUNCATE on public."licenses" to "service_role";
grant REFERENCES on public."licenses" to "service_role";
grant TRIGGER on public."licenses" to "service_role";
grant SELECT on public."licenses" to "authenticated";
grant INSERT on public."profiles" to "service_role";
grant SELECT on public."profiles" to "service_role";
grant UPDATE on public."profiles" to "service_role";
grant DELETE on public."profiles" to "service_role";
grant TRUNCATE on public."profiles" to "service_role";
grant REFERENCES on public."profiles" to "service_role";
grant TRIGGER on public."profiles" to "service_role";
grant SELECT on public."profiles" to "authenticated";
grant INSERT on public."pending_customer_licenses" to "service_role";
grant SELECT on public."pending_customer_licenses" to "service_role";
grant UPDATE on public."pending_customer_licenses" to "service_role";
grant DELETE on public."pending_customer_licenses" to "service_role";
grant TRUNCATE on public."pending_customer_licenses" to "service_role";
grant REFERENCES on public."pending_customer_licenses" to "service_role";
grant TRIGGER on public."pending_customer_licenses" to "service_role";
grant INSERT on public."devices" to "service_role";
grant SELECT on public."devices" to "service_role";
grant UPDATE on public."devices" to "service_role";
grant DELETE on public."devices" to "service_role";
grant TRUNCATE on public."devices" to "service_role";
grant REFERENCES on public."devices" to "service_role";
grant TRIGGER on public."devices" to "service_role";
grant SELECT on public."devices" to "authenticated";
grant INSERT on public."pending_email_licenses" to "service_role";
grant SELECT on public."pending_email_licenses" to "service_role";
grant UPDATE on public."pending_email_licenses" to "service_role";
grant DELETE on public."pending_email_licenses" to "service_role";
grant TRUNCATE on public."pending_email_licenses" to "service_role";
grant REFERENCES on public."pending_email_licenses" to "service_role";
grant TRIGGER on public."pending_email_licenses" to "service_role";
grant INSERT on public."email_licenses" to "service_role";
grant SELECT on public."email_licenses" to "service_role";
grant UPDATE on public."email_licenses" to "service_role";
grant DELETE on public."email_licenses" to "service_role";
grant TRUNCATE on public."email_licenses" to "service_role";
grant REFERENCES on public."email_licenses" to "service_role";
grant TRIGGER on public."email_licenses" to "service_role";
grant INSERT on public."system_settings" to "anon";
grant SELECT on public."system_settings" to "anon";
grant UPDATE on public."system_settings" to "anon";
grant DELETE on public."system_settings" to "anon";
grant TRUNCATE on public."system_settings" to "anon";
grant REFERENCES on public."system_settings" to "anon";
grant TRIGGER on public."system_settings" to "anon";
grant INSERT on public."system_settings" to "authenticated";
grant SELECT on public."system_settings" to "authenticated";
grant UPDATE on public."system_settings" to "authenticated";
grant DELETE on public."system_settings" to "authenticated";
grant TRUNCATE on public."system_settings" to "authenticated";
grant REFERENCES on public."system_settings" to "authenticated";
grant TRIGGER on public."system_settings" to "authenticated";
grant INSERT on public."system_settings" to "service_role";
grant SELECT on public."system_settings" to "service_role";
grant UPDATE on public."system_settings" to "service_role";
grant DELETE on public."system_settings" to "service_role";
grant TRUNCATE on public."system_settings" to "service_role";
grant REFERENCES on public."system_settings" to "service_role";
grant TRIGGER on public."system_settings" to "service_role";
grant INSERT on public."phone_auth_accounts" to "service_role";
grant SELECT on public."phone_auth_accounts" to "service_role";
grant UPDATE on public."phone_auth_accounts" to "service_role";
grant DELETE on public."phone_auth_accounts" to "service_role";
grant TRUNCATE on public."phone_auth_accounts" to "service_role";
grant REFERENCES on public."phone_auth_accounts" to "service_role";
grant TRIGGER on public."phone_auth_accounts" to "service_role";
grant INSERT on public."admin_users" to "anon";
grant SELECT on public."admin_users" to "anon";
grant UPDATE on public."admin_users" to "anon";
grant DELETE on public."admin_users" to "anon";
grant TRUNCATE on public."admin_users" to "anon";
grant REFERENCES on public."admin_users" to "anon";
grant TRIGGER on public."admin_users" to "anon";
grant INSERT on public."admin_users" to "authenticated";
grant SELECT on public."admin_users" to "authenticated";
grant UPDATE on public."admin_users" to "authenticated";
grant DELETE on public."admin_users" to "authenticated";
grant TRUNCATE on public."admin_users" to "authenticated";
grant REFERENCES on public."admin_users" to "authenticated";
grant TRIGGER on public."admin_users" to "authenticated";
grant INSERT on public."admin_users" to "service_role";
grant SELECT on public."admin_users" to "service_role";
grant UPDATE on public."admin_users" to "service_role";
grant DELETE on public."admin_users" to "service_role";
grant TRUNCATE on public."admin_users" to "service_role";
grant REFERENCES on public."admin_users" to "service_role";
grant TRIGGER on public."admin_users" to "service_role";