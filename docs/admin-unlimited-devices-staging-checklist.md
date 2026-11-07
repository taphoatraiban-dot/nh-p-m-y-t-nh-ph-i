# Admin unlimited devices — staging verification

## Findings (read-only production inspection, 2026-11-08)
- `public.claim_device(text,text)` currently compares one stored `devices.device_id` against the caller's device and rejects a different ID.
- `public.devices` has primary key `user_id`, so storing multiple rows per admin there would require a destructive schema change; avoid that.
- `public.admin_users` currently has 2 entries. Verify their auth identities before rollout.
- `public.check_license` and `public.check_email_license` already contain admin license bypasses, but use `profiles.role`, whereas privileged RPCs and the proposed device exemption use `admin_users`. Review and unify these checks separately to avoid role drift.
- No Supabase development branch was present when checked. The GitHub branch is NOT a deployed database environment.

## Change
`supabase/migrations/20261108010000_admin_unlimited_devices.sql` adds a server-side `admin_users` exemption to `claim_device`, leaving customer behavior unchanged. It does not change the existing `devices` table, revoke sessions, or modify account records.

## Must pass before production
1. Confirm the 2 `admin_users` UUIDs match the intended original administrator identities; do not trust client role flags.
2. Create a separately isolated test database (only with cost approval, if required) and apply migration there.
3. Admin A: claim device A, then device B, both allowed; original session remains usable. Repeat for Admin B.
4. Customer: device A allowed; different device B rejected; device A still allowed.
5. Signed-out caller rejected. Forged client `is_admin` flag must not change server authorization.
6. Test concurrent logins, page reload, PIN unlock, and CuncunPrint printing from two devices.
7. Check frontend for any additional local single-device restriction or forced sign-out; `claim_device` exemption alone cannot prove all paths work.
8. Confirm RPC permissions, RLS, and audit logs. Do not expose service-role credentials or customer data.
9. Verify database backups and rollback of the original `claim_device` definition before deployment.

## Deployment status
GitHub test branch only. No SQL applied to production. No live-device end-to-end test performed.
