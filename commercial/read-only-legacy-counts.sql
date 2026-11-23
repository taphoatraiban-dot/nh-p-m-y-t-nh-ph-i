-- READ ONLY. Run on an isolated staging database before/after migrations.
-- Returns aggregate counts only; never exposes identities or license values.
select
 (select count(*) from public.admin_users) as admin_count,
 (select count(*) from public.devices) as devices_count,
 (select count(*) from public.licenses) as licenses_count,
 (select count(*) from public.email_licenses) as email_licenses_count,
 (select count(*) from public.member_subscriptions) as member_subscriptions_count,
 (select count(*) from public.ott_memberships) as ott_memberships_count,
 (select count(*) from public.profiles) as profiles_count;
-- Record baseline and compare after commercial-only staging migration.
-- Counts alone do NOT prove record-level integrity; compare full backups separately.
