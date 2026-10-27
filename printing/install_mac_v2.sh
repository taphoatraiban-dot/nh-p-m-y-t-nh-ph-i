#!/bin/bash
set -euo pipefail
ROOT="$HOME/Library/Application Support/CuncunPrinterV2"
AGENT="$HOME/Library/LaunchAgents/icu.cuncun.print-queue-v2.plist"
mkdir -p "$ROOT" "$HOME/Library/LaunchAgents"
chmod 700 "$ROOT"
BASE="https://raw.githubusercontent.com/taphoatraiban-dot/nh-p-m-y-t-nh-ph-i/feature/cuncun-one-tap-print-20261028"
curl -fsSL "$BASE/printing/mac_queue_worker.py" -o "$ROOT/worker.py"
python3 -m py_compile "$ROOT/worker.py"
printf 'Supabase URL [https://zigpqddlhvjbjrwhfhaa.supabase.co]: '
read -r URL
URL="${URL:-https://zigpqddlhvjbjrwhfhaa.supabase.co}"
printf 'Email duoc phep in (cach nhau bang dau phay): '
read -r EMAILS
if [ -z "$EMAILS" ]; then echo "Can nhap email"; exit 1; fi
printf 'Supabase service_role key (an ky tu): '
read -rs KEY
printf '\n'
if [ -z "$KEY" ]; then echo "Chua nhap khoa"; exit 1; fi
umask 077
python3 - "$ROOT/env.json" "$URL" "$EMAILS" "$KEY" <<'PY'
import json,sys
with open(sys.argv[1],"w") as f: json.dump({"SUPABASE_URL":sys.argv[2],"CUNCUN_ALLOWED_EMAILS":sys.argv[3],"SUPABASE_SERVICE_ROLE_KEY":sys.argv[4]},f)
PY
unset KEY
cat > "$ROOT/launch.py" <<'PY'
import os,json,runpy
root=os.path.dirname(__file__)
with open(os.path.join(root,"env.json")) as f:
    env=json.load(f)
os.environ.update(env)
runpy.run_path(os.path.join(root,"worker.py"),run_name="__main__")
PY
cat > "$AGENT" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>icu.cuncun.print-queue-v2</string>
<key>ProgramArguments</key><array><string>/usr/bin/python3</string><string>$ROOT/launch.py</string></array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>$ROOT/worker.log</string>
<key>StandardErrorPath</key><string>$ROOT/worker.log</string>
</dict></plist>
EOF
chmod 600 "$ROOT/env.json" "$AGENT"
launchctl bootout "gui/$(id -u)" "$AGENT" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENT"
echo "DA CAI CUNCUN PRINT V2. Xem log: tail -n 30 \"$ROOT/worker.log\""
