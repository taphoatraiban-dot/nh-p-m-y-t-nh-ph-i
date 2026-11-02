-- STAGING REVIEW ONLY. Do not apply to production without auditing all table policies.
-- This helper is designed for authenticated table policies to gate phone users.
-- Legacy Gmail users are handled by their existing policies and are NOT automatically granted here.
create or replace function public.phone_auth_has_active_license(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $sql$
  select p_user_id is not null
    and p_user_id = (select auth.uid())
    and exists (
      select 1 from public.phone_auth_accounts a
      join public.licenses l on l.user_id = a.user_id
      where a.user_id = p_user_id
        and a.status = 'approved'
        and l.active is true
        and (l.expires_at is null or l.expires_at > now())
    );
$sql$;
revoke all on function public.phone_auth_has_active_license(uuid) from public, anon;
grant execute on function public.phone_auth_has_active_license(uuid) to authenticated;
-- IMPORTANT: This function by itself enforces nothing. Every relevant RLS policy
-- must be reviewed and adapted, and legacy Gmail access must remain intact.
-- Example condition for phone-owned rows (not a complete policy):
--   user_id = (select auth.uid())
--   and (select public.phone_auth_has_active_license(auth.uid()))
