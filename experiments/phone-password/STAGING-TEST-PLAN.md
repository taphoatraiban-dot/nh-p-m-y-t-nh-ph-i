# Phone/password release verification — 2026-11-02

## Environment status
- Production Supabase: zigpqddlhvjbjrwhfhaa. No database development branches were listed at audit time.
- No production migration, Edge Function deployment, or live account creation was performed.
- Creating a Supabase database branch may incur charges; request cost confirmation before creation.

## Required staging run (do not run against Production)
1. Snapshot/backup staging and verify its restore path.
2. Apply phone_auth_accounts migration, phone_access_rls_helper.sql, then staging_restrictive_rls.sql; verify schema and policies.
3. Deploy phone-password-auth Edge Function with unique PHONE_ALIAS_SECRET (>=32 bytes), correct environment variables, and appropriate JWT verification configuration.
4. Run register/login for new phone identity. Pending must be denied. Approve 1m/3m/12m/permanent with existing Admin account; verify access and expiry.
5. Verify deny/revoke immediately blocks previously issued sessions from reading/writing print_queue, printed_phoi, telegram_messages and customer_message_archive.
6. Verify Gmail admin, Gmail customer, and service-role workers still function as before.
7. Validate UI login session handoff, token refresh, logout, network failures, rate limits, and CSRF/XSS concerns.
8. Review all 55 existing public RLS policies for other private tables; restrict as appropriate.
9. Confirm no phone-number verification: phone ownership is not proven without SMS; clearly communicate account recovery limitations.
10. Run CI and smoke tests, review PR #19, then authorize production release separately.

## Known blockers
- Admin operations update license, account status and audit in separate steps; partial failure can cause inconsistent state. Prefer one transactional database RPC.
- Phone auth is disabled in preview UI until staging passes.
- No verified integration test results yet; static tests alone do not establish security.
