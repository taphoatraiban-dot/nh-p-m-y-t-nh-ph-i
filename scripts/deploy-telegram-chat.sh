#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Exercise the two authentication paths before touching the deployment.
node --test tests/chat/worker-auth.test.cjs tests/chat/endpoint.test.cjs tests/chat/hide-endpoint.test.cjs tests/chat/gateway-guard.test.cjs
# Keep this flag even though config.toml records the same setting.
supabase functions deploy telegram-chat --project-ref zigpqddlhvjbjrwhfhaa --no-verify-jwt
node scripts/check-telegram-chat-gateway.cjs
