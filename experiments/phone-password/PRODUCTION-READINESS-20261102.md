# Production readiness check — 2026-11-02

Verified read-only against Production Supabase `zigpqddlhvjbjrwhfhaa`:
- `public.phone_auth_accounts` does not exist.
- `public.phone_auth_audit` does not exist.
- `public.licenses.expires_at` is NOT NULL; permanent phone licenses require the staging migration.
- PR #19 remains draft and unmerged.
- GitHub checks on `70e1c3da955c9e4e968be905b71f75d40a89da35`: phone auth guardrails, parser regression, and Mac print worker all passed.

Release gate: integration tests of schema, RPC, JWT, RLS, legacy Gmail, print/Telegram and revoke must pass on an isolated database first. Do not deploy SQL or Edge Function to Production until then. Creating a Supabase branch may incur cost; obtain approval first.

## Existing project discovery
- `nptywmazyvfmbybedjim` (WEB PM) is active but has `license_admins`, `license_requests`, `licenses` and is NOT a verified empty staging environment; do not run Cuncun migrations there.
- `mrtluskjjipxqnjybofm` (phone-manager) is inactive and should not be repurposed.
- No migration or Edge Function deployment has been performed in any project.
