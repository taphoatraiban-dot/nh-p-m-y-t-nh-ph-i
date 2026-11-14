# THƯỜNG / PRO / ADMIN — review before rollout

Base: main c9931c087e6cc682012ecca8892123c63c99c3d1 (14 November 2026).

## Result

- THƯỜNG keeps the existing basic entry, calculations, price tables, customer messages, archives, statistics, balances and history. TOP 10 and the per-type summary use blurred synthetic placeholders with a lock and PRO label. Regional/day totals and collection amounts remain available.
- PRO and ADMIN load both reports through `pro_calculation_report`; its server check requires an active license and a fresh database edition or canonical Admin membership. Existing printer/QR/live feature scope remains as on main.
- Admin authority comes from `admin_users`, shared by license checks and six legacy CUNCUN Admin RPCs. No Admin membership is added or removed. Inspection found two existing Admin members, matching the two profile Admins.
- Direct profile role/edition/identity changes from API roles are blocked by a trigger even if broader profile write grants are introduced later. Admin membership writes are revoked from browser roles. The existing Admin edition RPC retains its server membership check, refuses Admin downgrades, and can create a missing ordinary profile for an existing account.
- Missing profile/edition and failed verification default to THƯỜNG. Downgrade clears displayed reports and invalidates pending responses. Server report authorization takes effect on the next request without JWT refresh. Existing 60-second/focus/visibility license checks update open tabs.
- Device rows use the registered phone number; missing phone data gets an explicit fallback. Admin can change every non-Admin account between THƯỜNG and PRO.
- Forty archived `index*.html` routes redirect to the canonical entry, preserving query and fragment. Their originals are in the external source backup; they must not remain as public application entry points.

No customer data, price tables, wager parser, settlement formula or license expiry is rewritten. The report API aggregates transient normalized rows from the existing calculation engine, without storing them or accepting another account's identifier. Basic local wager data can naturally be recomputed by its owner; this change protects the application report service, not against independent arithmetic on user-owned data.

## Verification

Local PostgreSQL (PGlite) + DOM tests: 21 passed, 0 failed. Covers THƯỜNG/PRO/ADMIN, both Admin fixtures, anonymous access, stale profile Admin, missing profile, phone/email-license isolation, self-promotion, Admin downgrade protection, edition changes without token refresh, malformed payloads, revoked licenses, duplicate/fractional aggregation, top-ten order and stale response races.

Browser component checks: 5 passed, 0 failed. Chromium/Cốc Cốc headless at 390×844, 412×915 and 1440×900; verifies locks, visible collection amount, edition badges, Admin-only controls and downgrade. Also checks all 40 legacy route redirects. These are component/viewport checks, not complete application sessions or physical iPhone/Android verification.

Existing focused regression suite: 371 passed, 4 failed both before and after this patch, with the same failing names:

1. four stations with identical bets print one table and correct sum
2. direct receipt compacts identical repeated bets and preserves 161k
3. LOCK: malformed hyphenated DA length blocks entire phoi
4. LOCK: shared B applies to every DA pair across all compact groups and later line

Those pre-existing failures remain unresolved; this authorization patch does not modify money parsing or printing to address them.

## Remaining release gates

This is a draft. Do not merge or deploy yet.

1. Test the migration against an isolated copy of the production schema (including actual RLS, Auth triggers and all account RPCs). PGlite fixtures do not replace this.
2. Run full signed-in application sessions with dedicated THƯỜNG, PRO and ADMIN test accounts. Test direct HTTP RPC/Edge Function requests using their real JWTs, including the separate WEB PM approval service. Local database-role tests are not HTTP end-to-end tests.
3. Verify on physical iPhone/Safari and Android/Chrome plus desktop, including input, price lookup, saved phơi/tin, balances/history, printing, report loading, cross-device upgrade/downgrade, logout and network loss.
4. Resolve or explicitly triage the four existing regression failures. Require permission workflow and repository checks to pass on the final head.
5. Take a fresh production backup and confirm a restore point. The workspace contains a source archive and authorization snapshots, not a full production database/data backup.

## Rollout and rollback

- Apply only `20261114160000_account_permission_hardening.sql` after staging verification. Do not rerun the earlier edition migration, which backfills existing Standard profiles to Pro.
- Apply the additive server changes before publishing the frontend. The earlier frontend continues to work while the new report RPC becomes available. Verify both original Admins before publishing the UI.
- No production migration or main update was performed during this task.
- If the frontend fails, restore the prior deployment from the source archive; keep safe server guards while investigating. If a server rollback is required, restore the exact function definitions and grants from the pre-rollout schema backup, then drop the new report RPC, authority trigger and its private helper. Do not bulk-change account editions or Admin membership.

## Reproduce

```
cd tests/permissions
npm ci --ignore-scripts --no-audit --no-fund
npx playwright install --with-deps chromium
npm test
```

For a preinstalled compatible Chromium browser, set `PW_EXECUTABLE` to its executable. Set `PERMISSION_SCREENSHOTS` to an existing output directory to capture viewport examples.

## Recheck for requested release

A second verification run reproduced all 26 permission/viewport passes. An isolated PostgreSQL 17 + PostgREST 16.5 environment was then created locally from a schema-only snapshot of the nine relevant production permission/license tables, their constraints, all eight relevant RLS policies, grants and eight existing authorization functions. No production account/customer rows were copied. The new migration applied successfully. Eighteen HTTP/JWT checks passed, including direct endpoint denial, metadata spoofing, stale profile Admin roles, both Admin fixtures, missing profiles, malformed/expired JWTs and cross-session downgrade without token refresh. This does not cover the entire production schema, Auth service or separate WEB PM service.

Expanded login/PIN/desktop-entry checks now pass 26/26. Test fixtures were updated to supply the logout permission reset dependency and existing browser animation/event dependencies; a wrong-local-PIN case now explicitly tests the no-cloud-PIN path. An additional check verifies that a cloud PIN rejects a stale locally cached PIN. Application login, PIN and money calculation code was not changed in this recheck.

The original focused money/parser/receipt suite remains 371 passed / 4 failed on the same head and the original main. A broader check also found a pre-existing syntax error in `tests/printer-transport-settings.test.cjs`; that unrelated file is not modified by this PR.

Release remains on hold: complete application authentication flows, separate WEB PM authorization, iPhone/Android execution beyond component viewport tests, and a verified full production restore point are still unverified. The current production database has no `pro_calculation_report` RPC and no new profile authority trigger. Publishing the frontend before the server migration would leave PRO report loading unavailable. No production migration or main update was made during recheck.
