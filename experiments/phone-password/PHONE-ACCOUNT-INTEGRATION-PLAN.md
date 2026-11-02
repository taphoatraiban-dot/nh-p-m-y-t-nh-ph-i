# Phone + password integration: safe rollout gates

Current state: phone registration, login, sessions and local UI work on a private PostgreSQL instance. **No phone session is a Supabase Auth session.** Gmail login and existing account entitlements remain unchanged.

1. Keep all new phone accounts in pending state by default; do not grant Cuncun data access at registration.
2. Require authenticated existing administrator action to approve, revoke and set expiry. Never accept administrator IDs, approval status or account IDs from an untrusted phone client.
3. Implement server-side account-to-entitlement mapping and enforce it on every protected operation; reject all requests without valid approval, expiry and revocation checks.
4. Design a secure Supabase Auth bridge or server-side access gateway before using existing RLS-protected Cuncun data. A custom phone session cannot simply impersonate auth.users.
5. No SMS: the phone is an unverified login identifier, not evidence of number ownership. Do not automatically merge by phone, recover Gmail accounts by phone, or allow phone-only password reset. Define recovery and abuse controls before public release.
6. Production hardening: persistent per-IP/per-identifier rate limiting, CSRF defenses, Secure cookies over HTTPS, audit logs, admin authorization and tests for privilege escalation and account takeover.
7. Test only on isolated branch and LOCAL DB. No production deployment or schema change until explicit approval.

The access-policy module only models deny-by-default approval; it does not yet connect to live admin permissions or Supabase.
