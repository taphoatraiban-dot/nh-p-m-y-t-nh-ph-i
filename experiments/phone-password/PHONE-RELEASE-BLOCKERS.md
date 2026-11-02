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

## Supabase environment audit (2026-11-02, read-only)
- Production project `zigpqddlhvjbjrwhfhaa` is ACTIVE_HEALTHY. It has no Supabase development branches and no phone-auth tables/functions deployed.
- A Supabase development branch is billed at USD 0.01344/hour for this organization (about USD 9.81 per 30-day month if left running). Do not create one without explicit user approval; prefer local Supabase for a no-extra-cost staging rehearsal.
- Production schema currently has `public.admin_users` (2 memberships) and `public.profiles.role='admin'` (2 users); both sets match exactly. There are 5 active Gmail/email licenses. The separate `public.licenses` table has no active rows and its `expires_at` column is currently NOT NULL. Existing `check_email_license()` checks Admin via `profiles.role` and Gmail via `email_licenses`.
- The experimental migration adds phone-only tables and a phone branch to `check_email_license()`, and makes only `public.licenses.expires_at` nullable. It has NOT been applied. Applying it to production now is prohibited: no phone staging validation has been performed.
- Next no-cost gate: apply the experimental migration only to the user's isolated local Supabase database, deploy the Edge Function only to local Supabase, and exercise register/login/admin approval/revoke plus Gmail regression. Confirm the local database is the disposable `cuncun-phone-local` instance before applying SQL.

## Local runtime evidence — 2026-11-02 (user-confirmed)
- Supabase Local restarted successfully after running `202611020000_local_prerequisites.sql` before `202611020001_phone_auth_accounts.sql`. This prerequisite migration currently exists on the user's Mac only; it is **not yet committed** to this branch. Never run the production-only migration assumptions against a fresh Local database without the prerequisites.
- A new Local database was observed with zero Auth users, phone accounts, licenses, and admin memberships. The previous Local users were not recovered; no production users were affected.
- User verified a 340 KB local pg_dump file with `pg_restore --list`. This confirms readable archive metadata, **not** a full restore rehearsal.
- Edge Function served at localhost; invalid action with an allowed Origin returned `INVALID_ACTION` (400). A missing Origin returned `ORIGIN_NOT_ALLOWED` (403).
- Local registration of test phone `0900000001` returned `success:true,status:pending`; database query confirmed `+84900000001` with status `pending`.
- Logging in before approval returned `LICENSE_NOT_APPROVED` (403). **Approval, post-approval login, expiration, revocation, legacy Gmail regression and production RLS integration were NOT validated in this runtime session.**
- User asked to skip further manual trial accounts and proceed toward release. This does not remove security or release gates. Do not merge the divergent feature branch wholesale or deploy the Edge Function to production.

## Immediate release work, no production writes
1. Carry the Local-only prerequisite migration into the isolated test setup without inadvertently shipping it to production; ensure migrations can bootstrap a clean Local database and remain safe for an existing production schema.
2. Review phone account identity/ownership and recovery: phone numbers are unverified without SMS; prohibit phone-based recovery or reassignment absent separate verification.
3. Validate end-to-end approval and access with existing admin membership, RLS and legacy Gmail flows in a safe environment. Document negative cases, audit and rollback.
4. Extract a minimal reviewed change set from this branch (180 commits ahead and 4 behind main as observed), instead of merging unrelated changes.
5. Before production deployment, back up production, obtain explicit release approval, deploy with rollback plan and verify no regression.
