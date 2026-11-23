-- Read-only preflight for migration 20261108020000_protect_admin_rpcs.sql
-- Run on staging before applying migration; expected 4 rows, each anchor_count = 1.
WITH expected(signature, anchor) AS (
 VALUES
 ('public.admin_member_change(uuid,text,text)', '  IF p_action = ''grant'' THEN'),
 ('public.admin_reset_device(uuid)', '  delete from public.devices'),
 ('public.admin_activate_license(uuid,text,integer,text)', '  select expires_at'),
 ('public.admin_set_license_active(uuid,boolean)', '  update public.licenses')
), defs AS (
 SELECT signature, anchor, pg_get_functiondef(to_regprocedure(signature)) AS body
 FROM expected
)
SELECT signature,
 CASE WHEN body IS NULL THEN 0 ELSE
 (length(body)-length(replace(body,anchor,'')))/length(anchor) END AS anchor_count,
 body LIKE '%SECURITY DEFINER%' AS security_definer,
 body LIKE '%auth.uid()%' AS has_caller_check
FROM defs;
-- After staging deployment, verify admin target rejection for all four RPCs
-- and customer-path behavior using disposable staging users only.
-- Do NOT invoke mutation RPCs against production for testing.
