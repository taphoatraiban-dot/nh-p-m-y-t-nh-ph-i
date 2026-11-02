# Phone/password release gate — not production ready

## Verified progress (2026-11-02)
- Local test suite: 103/103 passed, 0 failed, 0 skipped, including real local PostgreSQL registration/login/logout persistence and pending -> approve -> revoke with audit assertions.
- GitHub Actions workflow `Phone registration isolated tests`: completed successfully for the latest preview update.
- Admin authorization in the staging Edge Function now checks the existing `public.admin_users` membership table, not `profiles.role`; the experimental `check_email_license()` migration also preserves existing admin membership access.
- These checks are local/CI evidence only. No staging Supabase migration or Edge Function has been deployed.


Completed in isolated branch: phone credential hashing/session prototype; private PostgreSQL account/grant/audit stores; localhost HTTP API; admin verification adapters; admin HTTP preview; local phone grant access gate.

Must finish before production release:
1. **Identity architecture**: phone sessions are NOT Supabase Auth JWTs. Choose and implement secure server-side access to existing app data with proper RLS enforcement, or verified account linking. Never bypass RLS.
2. **Real admin verification**: test existing email/password session against Supabase Auth getUser and trusted public.admin_users server query. Public Auth settings HTTP 200 is not evidence of admin authorization.
3. **CSRF/session security**: implement real server-generated, session-bound CSRF; secure HttpOnly cookies, origin/host protections, abuse controls, logging without secrets, and HTTPS hosting. Static preview lacks CSRF token intentionally.
4. **Phone ownership and recovery**: no SMS means no verified possession of phone number; label number as unverified and design safe recovery/duplicate handling. Approval alone does not prove ownership.
5. **Production storage and migrations**: reviewed migrations, RLS, backup, audit, expiry/revocation, and rollback; staging first, no writes to production without explicit approval.
6. **Full end-to-end**: register -> pending -> real admin approval -> access -> expiration/revocation, with negative tests and legacy Gmail regression.

Never deploy experimental auth directly to cuncun.icu. No live credentials or production changes are included here.
