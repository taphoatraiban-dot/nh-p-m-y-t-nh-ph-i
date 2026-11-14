# Telegram requires PRO / ADMIN

The dynamically created Telegram Chat launcher and inbox were missing the edition gate. The Chat API checked an enabled Chat account but did not verify the software edition, so a Standard account with an existing Chat connection could still enter.

The fix gates dynamic Chat/VPS/Bot controls, shows a PRO notice for Standard, suppresses Standard's legacy Telegram polling, and discards loaded/pending Chat state on downgrade. A new hashed bundle forces clients to receive the corrected Chat code. PRO access restoration is signaled after the authenticated application opens.

Seven user-facing Edge Functions perform a fresh database entitlement check after authenticating the user: telegram-chat, telegram-member-sync, telegram-self-service, telegram-customer-bots, telegram-tenant, telegram-forward-inbox and telegram-push. Sync-key workers are checked after key verification, too. Existing Admin-only group/approval functions retain their Admin guards. Trusted bot webhooks/shared server-secret ingestion remain server operations; no bot messages or notifications were sent during validation.

The database helper allows the canonical original Admins, or a Pro profile with an active approved phone/email license. Missing profiles, Standard accounts, expired licenses and profile-only Admin roles do not grant Telegram access. Arbitrary-user entitlement lookup is callable only by service_role. Restrictive RLS policies prevent direct authenticated table access from bypassing the feature gate; existing ownership policies remain in effect. The push dispatcher excludes Standard accounts from both new and already queued delivery claims.

No pricing, calculation formula, customer data, Telegram history, account tier or Admin membership is rewritten. Stored Telegram connections are retained; downgrade prevents use without deleting them.

Validation includes 77 permission/Telegram regression checks, 47 complete Chat behavior checks, and 394 core parser/calculation/login/PIN checks. Coverage includes all seven Standard-denied/Pro-allowed routes, direct-table RLS, metadata spoofing, expired licenses, cached Chat cleanup, late-response races, worker-key denial after downgrade, and notification queue exclusion. The existing real-Auth phone/desktop sessions also assert the dynamic Telegram launcher is hidden for Standard and visible for Pro/Admin. Phone tests are browser emulation, not physical hardware tests.

Rollout: apply only 20261114170000_telegram_pro_tier_gate.sql, deploy the seven modified Edge Functions preserving each live verify_jwt setting, verify production entitlement read-only, then publish the frontend after CI. The workspace backup directory contains all seven original Edge bundles, the previous push claim function/policies and a targeted SQL rollback script. For rollback, restore Edge bundles before dropping their new database helper.
