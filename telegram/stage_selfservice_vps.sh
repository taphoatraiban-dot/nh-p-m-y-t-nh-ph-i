#!/usr/bin/env bash
# Deploy isolated Telegram self-service OTP module. Run on VPS as root.
# Does NOT touch legacy Telegram bots or tenants; requires explicit credentials to enable OTP.
set -Eeuo pipefail
REPO="https://raw.githubusercontent.com/taphoatraiban-dot/nh-p-m-y-t-nh-ph-i/main/telegram"
UNIT="ongthantai-telegram-selfservice.service"
STAGE="/opt/ongthantai-telegram-selfservice"
SECRETS="/etc/ongthantai-telegram-selfservice/telegram-login.env"
echo "Checking existing self-service unit..."
systemctl cat "$UNIT" >/dev/null
systemctl is-active --quiet "$UNIT" || { echo "Existing service is not active; refusing automatic change"; exit 1; }
mkdir -p "$STAGE" /var/backups/ongthantai-telegram-selfservice
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
curl -fsSLo "/tmp/telegram-login-flow-$STAMP.py" "$REPO/telegram_login_flow.py"
curl -fsSLo "/tmp/telegram-selfservice-$STAMP.py" "$REPO/selfservice_api.py"
python3 -m py_compile "/tmp/telegram-login-flow-$STAMP.py" "/tmp/telegram-selfservice-$STAMP.py"
install -m 0644 "/tmp/telegram-login-flow-$STAMP.py" "$STAGE/telegram_login_flow.py"
install -m 0644 "/tmp/telegram-selfservice-$STAMP.py" "$STAGE/selfservice_api.py"
echo "Source staged at $STAGE (no running process changed)."
echo "Service status: $(systemctl is-active "$UNIT")"
echo "Existing unit config:"
systemctl show "$UNIT" -p ExecStart -p WorkingDirectory -p EnvironmentFiles --no-pager
if [[ ! -f "$SECRETS" ]]; then
  install -d -m 0700 /etc/ongthantai-telegram-selfservice
  (umask 077; cat > "$SECRETS" <<'EOF'
# Populate privately on VPS. Never paste values in chat or GitHub.
# TELEGRAM_API_ID=
# TELEGRAM_API_HASH=
# TELEGRAM_SESSION_KEY=
TELEGRAM_LOGIN_ENABLED=0
TELEGRAM_SESSION_DIR=/var/lib/ongthantai-telegram-sessions
EOF
  )
fi
chmod 0600 "$SECRETS"
install -d -m 0700 /var/lib/ongthantai-telegram-sessions
echo "The old service and bot sessions remain untouched."
echo "Next: provision TELEGRAM_API_ID, TELEGRAM_API_HASH and TELEGRAM_SESSION_KEY,"
echo "install Telethon+cryptography in the service's Python environment,"
echo "and wire staged source + env file to its actual systemd ExecStart."
echo "Do not enable TELEGRAM_LOGIN_ENABLED until OTP and tenant isolation tests pass."
