# Read-only admin verification: existing email/password session

The production app login is email + password. Do not ask the operator to share credentials, access tokens, refresh tokens, or service-role keys. A public /auth/v1/settings HTTP 200 only confirms public API reachability, not an admin session.

## Safe next implementation

1. On the user's own Mac, use the **existing authenticated browser session** and a server-side authenticated endpoint that calls Supabase Auth getUser(access_token). Do not paste tokens into a shell or chat, or log them.
2. Verify admin membership on the server with a trusted DB client against public.admin_users, matching verified user.id. Never accept a user-supplied user_id or browser-provided admin flag.
3. Return only {authenticated:boolean, admin:boolean}; no email, user ID, tokens, or sensitive DB rows.
4. Enforce same-origin, CSRF for state-changing routes, rate limits, secure cookies, and deny-by-default. Do not use a static HTML file or client-side key to query admin_users with elevated privileges.
5. Before wiring production, test with an authorized admin and a non-admin; check RLS and legacy authorization logic.
6. The phone-password prototype is NOT a Supabase Auth session. Do not link it to existing email accounts or expose production RLS data without an explicit verified account-linking design.

Status: DOCUMENTATION ONLY. No production server endpoint has been mounted; no database writes or deployment.
