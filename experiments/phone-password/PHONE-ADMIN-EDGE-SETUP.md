# Phone password auth + Admin approval (experimental)

This folder contains a proposed Supabase Edge Function and SQL migration. They are **not deployed** and do not change the production project until explicitly reviewed and deployed.

## Flow

- Register: normalize VN mobile number, derive a synthetic email with HMAC-SHA256 using server-only `PHONE_ALIAS_SECRET`, create a Supabase Auth email/password user, and insert `public.phone_auth_accounts` with status `pending`.
- Login: authenticate with the derived synthetic email and return the Supabase session. The app's `check_email_license()` denies app access until an Admin approves the account.
- Admin: verify the supplied bearer token with Supabase Auth, then require `public.profiles.role = 'admin'`. Pending list and approve/deny/revoke actions run server-side using the service-role client.
- Approval creates/extends `public.licenses`; permanent access uses `expires_at = NULL`. The migration extends `check_email_license()` while preserving the existing Admin and Gmail email-license branches.
- Audit: each admin decision is recorded in `public.phone_auth_audit`.

## Required deployment order (staging only)

1. Create a separate Supabase staging project or use a disposable isolated branch. Never point this experiment at production.
2. Apply `supabase/migrations/202611020001_phone_auth_accounts.sql`.
3. Set Edge Function secrets: `PHONE_ALIAS_SECRET` (random, at least 32 bytes), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY`. Never expose service role or alias secret in the browser.
4. Deploy `supabase/functions/phone-password-auth/index.ts`.
5. Add an authenticated client UI that sends the current Supabase access token in the Authorization header. The function accepts only cuncun.icu origins plus localhost staging.
6. Test register, duplicate phone, login, pending denial, Admin approve/deny/revoke, 1/3/12-month extension, lifetime, expiry, and Gmail regression before considering production.

## Important limitations

- No SMS is sent and phone ownership is **not verified**. This is phone-as-username/password, not phone-number verification. Do not describe the number as verified.
- Registration does not grant a license.
- The Edge Function source and migration are not deployed by this commit. The staging preview is only a client UI; it does not deploy backend resources.
- The existing production `customer-register` function is a different legacy flow; do not modify or reuse it for this experiment.
- Before production, add persistent rate limiting, operational monitoring, account recovery, abuse controls, and a reviewed UI integration. Confirm that the app's current session/bootstrap path accepts the returned Supabase session and that the updated license RPC is compatible with all existing users.
