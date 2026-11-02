# Production RLS audit — read-only, 2026-11-02

Scope: public schema in Supabase project zigpqddlhvjbjrwhfhaa. **No database changes were made.**

Read-only inspection returned **55 policies across 27 tables**. This is a policy inventory, not an authorization penetration test.

## Critical release blockers

- `print_queue`: four ownership-based INSERT/SELECT/UPDATE policies without an explicit active phone-license check.
- `printed_phoi`: four ownership-based SELECT/INSERT/UPDATE/DELETE policies without an explicit active phone-license check.
- `telegram_messages`: owner-based read policy without an explicit active phone-license check.
- `customer_message_archive`: ownership-based read/write policies without an explicit active phone-license check.
- `profiles`: public read policy (`true`) and owner update policies; evaluate what profile fields phone users may access and update.
- Other ownership-based policies exist for devices, favorites, user API keys and other features. A phone-auth session is a normal Supabase Auth session; license enforcement at login alone does not prevent a previously issued session from accessing RLS-permitted data.

## Required release gate

1. Inventory policy commands, roles, USING and WITH CHECK expressions; classify public vs private resources.
2. Apply a phone-only active-license gate to **all relevant private data policies**, preserving legacy Gmail permissions. Handle permissive-policy OR composition correctly; adding a separate permissive policy does not restrict existing ones. Prefer carefully designed restrictive policies where compatible.
3. Verify with two different users, a pending phone account, an approved phone account, revoked/expired phone accounts with preexisting JWTs, and existing Gmail users.
4. Test service-role workers and existing integrations to avoid breaking Telegram, printing and background processing.
5. Confirm backups and restore procedure before applying migrations to production.

**Do not merge PR #19 or deploy the phone auth Edge Function until these checks pass.**
