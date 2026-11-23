-- READ-ONLY PRE-FLIGHT. Run before any staging rollout.
-- Returns counts and flags only, never emails, device IDs or customer records.
select
  (select count(*) from public.admin_users) as legacy_admin_count,
  to_regclass('public.ott_commercial_orders') is not null as commercial_table_present,
  (select count(*) from information_schema.routines
   where routine_schema='public'
     and routine_name in ('ott_admin_create_commercial_order',
                          'ott_admin_confirm_commercial_order',
                          'ott_admin_cancel_commercial_order',
                          'ott_admin_list_commercial_orders')) as commercial_rpc_count,
  (select count(*) from information_schema.routines
   where routine_schema='public'
     and routine_name in ('claim_device','admin_reset_device','check_license',
                          'check_email_license','member_access_status')) as legacy_rpc_count;
-- If commercial_table_present is true, STOP and inspect its actual schema before migration.
-- Verify backup/restore separately; this script does not establish restore readiness.
