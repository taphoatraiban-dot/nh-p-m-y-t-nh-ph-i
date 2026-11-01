-- READ-ONLY POST-FLIGHT: execute ONLY against an isolated staging Supabase project.
-- This inspects metadata; it never creates orders, invokes commercial RPCs or edits legacy data.
with commercial_functions as (
 select p.proname,
        has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
        has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in (
  'ott_admin_create_commercial_order','ott_admin_confirm_commercial_order',
  'ott_admin_list_commercial_orders','ott_admin_cancel_commercial_order')
), ledger as (
 select c.oid,c.relrowsecurity
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname='ott_commercial_orders' and c.relkind='r'
)
select
 (select count(*) from public.admin_users) as legacy_admin_count,
 (select count(*) from ledger)=1 as ledger_exists,
 coalesce((select relrowsecurity from ledger),false) as ledger_rls_enabled,
 coalesce((select not has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') from ledger),false) as ledger_anon_direct_access_denied,
 coalesce((select not has_table_privilege('authenticated',oid,'SELECT,INSERT,UPDATE,DELETE') from ledger),false) as ledger_authenticated_direct_access_denied,
 (select count(*) from commercial_functions) as commercial_rpc_count,
 (select count(*) from commercial_functions where anon_execute) as rpc_anonymous_execute_count,
 (select count(*) from commercial_functions where authenticated_execute) as rpc_authenticated_execute_count;
-- Expected after staged migration: ledger_exists=true, RLS=true, direct access denied=true,
-- commercial_rpc_count=4, rpc_anonymous_execute_count=0, rpc_authenticated_execute_count=4.
-- Metadata checks do NOT replace testing admin and non-admin identities or backup restoration.
