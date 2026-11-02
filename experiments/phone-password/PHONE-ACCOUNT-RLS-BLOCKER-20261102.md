# Phone-account access gate — production audit 2026-11-02

Read-only audit of current Production policies:

- `print_queue`: owner-based SELECT/UPDATE; INSERT owner policy; no phone license check.
- `printed_phoi`: owner-based SELECT/UPDATE/DELETE and INSERT; no phone license check.
- `customer_message_archive`: owner-based SELECT/UPDATE and INSERT; no phone license check.
- `telegram_messages`: owner email allowlist; no phone license check (phone account not granted by this policy).

**Release blocker:** Supabase Auth may issue a JWT for a phone account even if the Edge Function declines to return the session. A caller can authenticate directly against Supabase Auth with the alias email if known, bypassing Edge Function login checks. Existing owner-only policies then may grant private-table access. The app login check is not a substitute for RLS.

Before enabling phone login, install and integration-test the restrictive policies in `supabase/staging_restrictive_rls.sql` and audit every remaining private table. Test pending, approved, expired, denied, revoked, Gmail Admin, Gmail customer, and service-role worker access. Do not enable public phone-auth UI before passing these tests.

Current Production changes: isolated phone-auth tables, rate limit RPC, admin license RPC, nullable `licenses.expires_at`, Edge Function version 1. Existing `check_email_license` remains unchanged. No public UI enabled.
