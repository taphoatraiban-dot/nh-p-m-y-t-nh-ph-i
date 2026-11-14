# CUNCUN three-tier permissions — release verification

Base main: c9931c087e6cc682012ecca8892123c63c99c3d1. Release date: 14 November 2026.

## Behavior

THƯỜNG retains basic entry/calculation, prices, customer messages, archives, statistics, balances/history and required collection totals. TOP 10 and per-type Loại/Tổng/Trúng/Thu-Bù show synthetic blurred placeholders, a lock and PRO label. PRO/ADMIN load these reports through a server-authorized RPC. Admin-only controls remain hidden for customers and their server APIs reject customer calls.

Admin authority is read from admin_users rather than profile roles or editable metadata. The two original Admin memberships are preserved. Direct browser writes cannot change profile authority or Admin membership. Admin can switch ordinary accounts between Standard/Pro, including existing accounts missing a profile; Admin downgrade is rejected. Missing/failed authority verification defaults to Standard.

Editions are read from the database on each server check, without waiting for JWT refresh. Open pages recheck at the existing 60-second interval and on focus/visibility. Downgrade clears report content and invalidates pending responses. Device labels prefer the registered phone. Forty historical app pages redirect to the canonical entry.

No pricing, settlement formula, existing customer data, account edition or Admin membership is bulk-rewritten. An ambiguous hyphenated DA input containing a six-digit segment is rejected before normalization; valid two/four-digit groups remain accepted. Receipt/parser tests were corrected for actual wrapped station headings, unchanged original stakes and the twelve legitimate B2 rows at 180k (total 2160k); the overall expected 3468k remains asserted.

## Verification

- 405 focused parser/money/receipt, login/PIN, desktop-entry and printer-routing checks passed locally.
- 26 permission/database/DOM/browser-component checks passed.
- 18 HTTP/JWT checks passed against isolated PostgreSQL 17/PostgREST with schema-only copies of nine production permission/license tables, constraints, RLS and grants. Includes anonymous calls, metadata spoofing, stale profile Admin roles, self-promotion, invalid JWTs and cross-session downgrade.
- 12 full-page sessions passed with real GoTrue password login, PostgREST, production frontend logic, calculation/report rendering, direct Admin API denial and logout: Standard, Pro and two Admin fixtures at iPhone-size, Android-size and desktop viewports.
- Migration apply → rollback → reapply succeeded in the real-Auth test environment.
- WEB PM approval RPC definitions were inspected: both require server-side license_admins membership. That separate service was not modified.
- Production migration was applied before frontend publication. Read-only production checks confirmed both original Admins retain full access, Standard is denied PRO/Admin APIs, and all five licensed Pro accounts receive the report. Twelve inactive Pro accounts were not granted access.
- Production profile-row hash and both Admin IDs matched the pre-migration snapshot exactly. Browser grants cannot insert Admin membership or update edition.

Phone-size testing uses Chromium emulation, not physical iPhone/Android hardware or a Safari/WebKit compatibility guarantee. The separate WEB PM service was inspected, not tested through a complete live payment/approval flow. Independent recomputation of user-owned wager data is outside application licensing enforcement.

A broader, non-gating historical test run still has six pre-existing failures outside this patch: repeated-station 5464k parsing, a cache-busting URL assertion in the iOS bridge test, three legacy QR privacy/source-shape assertions, and a schedule assertion expecting validation inside the parser instead of the later strict-validation pipeline. They are not represented as passing, and this release does not change those unrelated behaviors.

## Backup and rollback

The workspace outputs/backup directory contains the original main archive, a fresh snapshot of all nine replaced function definitions/grants and account authority, plus rollback-three-tier.sql. The restore script was exercised before production deployment. This is a backup of all changed authority objects and the source, not an export of the entire production/customer database.

Rollback the frontend to the archived main if publication fails. To revert the server change, run the exact saved rollback script, which restores original function definitions and Admin-table grants and removes the new report RPC/authority trigger. It does not rewrite customer data or account editions. Do not replay the old blanket-Pro-backfill migration.

## Reproduce

Run npm ci in tests/permissions, then npm test after installing Playwright Chromium or setting PW_EXECUTABLE to a compatible browser. The Account permissions workflow also runs the 405 focused checks. Account permissions real Auth builds a disposable Auth/Postgres/PostgREST environment with synthetic users and tests full-page sessions plus migration rollback. It contains only fixture credentials and never authenticates against production.
