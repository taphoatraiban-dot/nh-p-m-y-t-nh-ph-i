# Phone/password release gate — not production ready

## Production phone-account inventory (read-only, 2026-11-02)

- Query against `public.phone_auth_accounts`: **0 total, 0 approved, 0 pending**.
- There are no tracked phone accounts requiring metadata backfill as of this query. This does **not** prove there are no orphaned phone alias identities in `auth.users`; that separate inventory remains outstanding.
- No production rows were changed. The live Edge Function still differs from the isolated branch and must not be replaced before end-to-end checks.

## Live compatibility finding (2026-11-02)

- GitHub Actions passed for isolated branch commit `fa0806c4` (run `41467217688`).
- Read-only comparison confirmed that the deployed `phone-password-auth` v1 and isolated branch differ. Live v1 creates phone users with `app_metadata.cuncun_auth_type = phone_password` and a mutable `user_metadata.auth_method`; the branch requires `app_metadata.auth_method = phone_alias` at login and access checks.
- **Compatibility gate:** do not replace the live function without first inventorying legacy phone identities. For any existing phone account, migrate the trusted server-side marker using its authoritative `phone_auth_accounts.user_id` record, not user-editable metadata. Test login and revocation on both old and new accounts in a safe environment.
- No production migration or deployment is authorized by this documentation change.

## Updated evidence and release decision (2026-11-02)

- **CI verified:** GitHub Actions `Phone registration isolated tests` succeeded for commit `0da847a8` (run `41466631126`). These are automated/static and local tests, not a production E2E sign-off.
- **Production read-only observation supersedes older claims below:** the production Supabase project was observed to contain `public.phone_auth_accounts` (0 rows), `public.phone_auth_audit` (0 rows), `public.admin_users` (2 rows), and an ACTIVE `phone-password-auth` Edge Function (version 1). Thus the earlier assertion that no phone-auth schema/function exists in production is **outdated**. No claim is made that the live function matches this branch or that its RLS is correct.
- **Still not released as a user-facing feature:** no verified integration into the existing `cuncun.icu` login screen. Do not infer user-facing readiness from production infrastructure existing.
- **New guards on isolated branch:** phone alias is marked in server-controlled `app_metadata`; the Edge Function rejects phone/Gmail identity mismatch; the staging preview checks both `check_access` and `check_email_license` on login, on page resume, and on restored-session connection.
- **Blocking release checks:** compare live Edge Function and SQL definitions to reviewed branch; verify existing Gmail/admin paths and RLS; run real pending → admin approve → login → revoke → denied access; confirm server-side enforcement for every protected data operation. A browser focus check is supplementary and cannot replace server authorization.
- **Cost/safety:** do not create paid staging branches, apply migrations, deploy functions, or merge the highly divergent feature branch into `main` without explicit release authorization and rollback preparation.

> The historical sections below describe earlier snapshots and should not be interpreted as current production inventory where they conflict with this update.

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
- Supabase Local restarted successfully after running `202611020000_local_prerequisites.sql` before `202611020001_phone_auth_accounts.sql`. The local prerequisite migration is now committed as `experiments/phone-password/supabase/migrations/202611020000_local_prerequisites.sql` (commit `3d4cf555`). It is **local-only** and must never be included in a production migration deployment. Never run the production-only migration assumptions against a fresh Local database without the prerequisites.
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
4. Extract a minimal reviewed change set from this branch (192 commits ahead and 4 behind main as observed on 2026-11-02), instead of merging unrelated changes.
5. Before production deployment, back up production, obtain explicit release approval, deploy with rollback plan and verify no regression.

## Additional review findings (2026-11-02)
- `phone-password-auth/index.ts` returns Supabase Auth sessions for approved phone aliases, but production app RLS and all existing client entry points still require integration verification. A successful Edge Function login response alone is not proof that the production app is authorized correctly.
- `PHONE_ALIAS_SECRET` must be set securely on the target environment before deployment; never commit the secret to GitHub.
- The experimental migration modifies the existing `check_email_license()` function. Obtain its live definition and compare behavior for both existing admin memberships and legacy Gmail licenses before any release.
- Password-based registration without SMS does **not** verify ownership of the submitted phone number. Do not offer phone-number-based password reset, number reassignment, or verified-phone claims without a separate identity check.
- Run local tests after the newly committed bootstrap migration and record results; this document does not claim those tests have been rerun.
