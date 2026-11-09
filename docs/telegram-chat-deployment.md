# Telegram Chat deployment contract

The function has two authentication paths: claim/ack validate a per-account sync-key hash; user operations validate getUser, account access, conversation access and the Chat PIN ticket. Workers do not send a user JWT. Keep `[functions.telegram-chat] verify_jwt = false` in `supabase/config.toml`; enabling the gateway blocks workers before their sync key can be checked.

Use `bash scripts/deploy-telegram-chat.sh` from the repository with an authenticated Supabase CLI (Node 24). It deploys only telegram-chat with the explicit no-verify-jwt flag and checks the live gateway. Do not redeploy a saved older function body: preserve current features. Do not set this option for other functions without reviewing their authentication.

The authentication guard runs on relevant PRs and main changes. Its live probe submits an invalid acknowledgement with deliberately invalid credentials; it cannot claim jobs or send messages. It fails when the platform JWT gate intercepts workers, the handler starts accepting invalid credentials, or the endpoint fails. A failed probe requires investigation; it does not restart services or change permissions automatically.

After deployment verify all enabled accounts have worker_seen_at within 120 seconds. If receive sync is active but sender heartbeats are stale, inspect HTTP status and gateway settings before restarting any worker. chat_outbox.py is an asyncio task inside the managed worker; there is no independent sender process to restart. Never remove Telegram sessions, receipt files or queued jobs to repair this condition.

This guard protects repository deployments. A person with dashboard or Management API access can still override the setting outside this workflow; repository checks cannot prohibit those external edits.
