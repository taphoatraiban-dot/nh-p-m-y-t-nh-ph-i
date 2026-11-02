-- STAGING ONLY. Requires phone_auth_accounts, licenses and phone_auth_has_active_license(uuid).
-- Add a RESTRICTIVE policy to each private table; unlike a permissive policy,
-- this is AND-ed with the existing owner policies, preserving Gmail behavior.
-- Check role grants and test service-role integrations before deployment.
-- A phone account is identified by its alias OR auth metadata; this reduces
-- reliance on phone_auth_accounts mapping for identifying phone identities.
-- NOTE: user metadata is not a trusted source of authorization; only used here
-- to make the restriction more conservative. The license helper must still pass.
create or replace function public.phone_auth_session_allowed()
returns boolean language sql stable security definer set search_path = ''
as $sql$
  select (select auth.uid()) is not null and (
    not exists (select 1 from auth.users u where u.id = (select auth.uid()) and (u.email like 'phone-%@accounts.invalid' or u.raw_app_meta_data->>'cuncun_auth_type' = 'phone_password' or u.raw_user_meta_data->>'auth_method' = 'phone_alias'))
    or public.phone_auth_has_active_license((select auth.uid()))
  );
$sql$;
revoke all on function public.phone_auth_session_allowed() from public, anon;
grant execute on function public.phone_auth_session_allowed() to authenticated;

-- Existing policies are permissive and target authenticated. Restrictive
-- policies enforce the phone license even if multiple permissive policies OR.
create policy phone_license_guard on public.print_queue as restrictive
  for all to authenticated using ((select public.phone_auth_session_allowed()))
  with check ((select public.phone_auth_session_allowed()));
create policy phone_license_guard on public.printed_phoi as restrictive
  for all to authenticated using ((select public.phone_auth_session_allowed()))
  with check ((select public.phone_auth_session_allowed()));
create policy phone_license_guard on public.customer_message_archive as restrictive
  for all to authenticated using ((select public.phone_auth_session_allowed()))
  with check ((select public.phone_auth_session_allowed()));
create policy phone_license_guard on public.telegram_messages as restrictive
  for all to authenticated using ((select public.phone_auth_session_allowed()))
  with check ((select public.phone_auth_session_allowed()));

-- This is NOT a complete rollout: audit remaining private tables, validate
-- legacy users and service-role workers, and test revoked JWTs in staging.
