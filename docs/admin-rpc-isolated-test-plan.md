# CUNCUN Admin RPC protection — isolated staging test plan

## Scope
PR #51, migration `20261108020000_protect_admin_rpcs.sql`.
No production changes. Never use real customers or real Admin identities in mutation tests.

## Free local option
Use an existing Mac mini with Docker Desktop (subject to its license) or a free compatible container runtime, plus the Supabase CLI local stack. Check installed tools and free disk space before installation. Local Supabase may require significant RAM and disk space; do not assume it is already available. Use a separate worktree/clone and local database only.

## Setup
1. Clone the repository and check out `fix/protect-admin-rpcs-20261108`.
2. Confirm local PostgreSQL/Supabase tools are available; avoid any remote project linking.
3. Start an isolated local database. Apply the *baseline* schema and preceding migrations in their required order, including `auth.uid()`, `profiles`, `admin_users`, `licenses`, `devices`, and `member_subscriptions`. Do not use production dumps or secrets.
4. Run `supabase/tests/admin_rpc_protection_preflight.sql`; all four anchors should have count=1.
5. Apply `supabase/migrations/20261108020000_protect_admin_rpcs.sql` only on this isolated database.
6. Verify the four modified functions contain the new Admin-target guards, preserve the caller Admin check, and retain the original customer mutation behavior.

## Disposable fixtures
Create two local-only Admin identities and two local-only customer identities. Assign Admin via both `admin_users` and `profiles.role` as required by the baseline. Do not copy production emails, passwords, tokens, or customer rows.

## Expected cases
| Caller | Target | RPC | Expected |
|---|---|---|---|
| Admin | Admin | admin_member_change grant/revoke | Rejected; subscription unchanged |
| Admin | Admin | admin_reset_device | `ok=false`; device unchanged |
| Admin | Admin | admin_activate_license | `ok=false`; license unchanged |
| Admin | Admin | admin_set_license_active | `ok=false`; license unchanged |
| Admin | Customer | admin_member_change grant/revoke | Original behavior |
| Admin | Customer | admin_reset_device | Original behavior |
| Admin | Customer | admin_activate_license | Original behavior |
| Admin | Customer | admin_set_license_active | Original behavior |
| Customer | Any | All four RPCs | Denied; no mutation |
| Anonymous | Any | All four RPCs | Execute denied; no mutation |

## Critical verification
- Inspect both returned values and database state before/after each test.
- Confirm the transaction rolls back on any failed migration anchor.
- Ensure other customer license extension RPCs still work as before.
- Review `profiles.role` and `admin_users` authorization consistency separately; not included in this patch.
- Verify that this patch does **not** guarantee protection from other privileged RPCs or service-role code; audit separately.

## Release gate
Do not merge PR #51 or deploy the migration to production until the isolated tests pass and a rollback/backup plan is reviewed. The PR is intentionally a draft.
