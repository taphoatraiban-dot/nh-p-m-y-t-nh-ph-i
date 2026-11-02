# Phone/password release readiness — 2026-11-02

## Implemented and independently checked
- Production Supabase project: `zigpqddlhvjbjrwhfhaa`.
- Edge Function `phone-password-auth` deployed; non-mutating GitHub Actions smoke tests verified invalid action, invalid origin, invalid phone, short password, missing admin token and missing access token.
- Phone account, audit and rate-limit tables, admin approval RPC and license gate helpers deployed.
- Seven critical tables have restrictive `phone_license_guard` policies: `print_queue`, `printed_phoi`, `customer_message_archive`, `telegram_messages`, `devices`, `customer_archive_audit`, `upgrade_requests`.
- `check_email_license()` now checks phone approval/license before legacy Gmail/admin rules. SQL inspection confirmed the phone gate, legacy admin branch and email license branch are present. This is NOT a behavioral regression test.
- Isolated registration and admin pages point at the deployed Edge Function. Main page on this release branch has phone session handoff.
- GitHub Actions at commit `94277cf158638614328506edaef9e0a3677dacbe`: phone auth release guardrails, parser regression, Mac print worker all passed.
- No SMS is sent. Phone number ownership is **not verified**; treat it as a username.

## Remaining hard release gates — NOT YET VERIFIED
1. Register a disposable, user-authorized test phone account and confirm `pending` cannot access application data, including via direct Supabase Auth login (not just Edge Function login).
2. Sign in as an existing authorized admin, approve the account for a fixed term, confirm a successful login and all required application data flows.
3. Revoke, deny and expire test licenses; verify session refresh and direct table access fail closed. Reapprove and verify restored access.
4. Exercise existing Gmail user/admin sign-in, license check, Telegram, receipt and printing workflows; check no regression.
5. Verify `cuncun.icu` deployment serves the new HTML routes and main app handoff; verify browser CORS, session and mobile Safari.
6. Check all other private tables and RPCs for phone-user access outside the seven guarded tables.

## Release decision
**HOLD — do not merge PR #19 into `main` or advertise phone login to customers until these gates pass.** CI smoke tests alone do not prove end-to-end security. Do not create arbitrary real-phone accounts or use paid SMS for testing.

## Operational notes
- Preserve existing Gmail accounts, licenses, Telegram and receipts.
- `nptywmazyvfmbybedjim` is not confirmed as an isolated staging database; do not repurpose it.
- `mrtluskjjipxqnjybofm` phone-manager project was canceled.
