#!/usr/bin/env bash
set -Eeuo pipefail

REPO_RAW="https://raw.githubusercontent.com/taphoatraiban-dot/nh-p-m-y-t-nh-ph-i/main/telegram"
UNIT_LIST="$(systemctl list-units --type=service --state=active --no-legend --plain | awk '{print $1}')"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Hãy chạy bằng sudo/root." >&2
  exit 1
fi

units=()
targets=()
while IFS= read -r unit; do
  [[ -n "$unit" ]] || continue
  exec_start="$(systemctl show "$unit" --property=ExecStart --value 2>/dev/null || true)"
  [[ "$exec_start" == *"member_sync.py"* ]] || continue
  target="$(python3 - "$exec_start" <<'PY'
import os, re, shlex, sys
raw = sys.argv[1]
match = re.search(r"argv\[\]=(.+?)(?:\s*;\s*|}\s*$)", raw)
if not match:
    raise SystemExit(2)
args = shlex.split(match.group(1))
paths = [arg for arg in args if arg == "member_sync.py" or arg.endswith("/member_sync.py")]
if len(paths) != 1:
    raise SystemExit(2)
print(os.path.realpath(paths[0]))
PY
  )" || continue
  units+=("$unit")
  targets+=("$target")
done <<< "$UNIT_LIST"

if [[ "${#units[@]}" -ne 1 ]]; then
  echo "Dừng an toàn: tìm thấy ${#units[@]} service đang chạy member_sync.py; cần kiểm tra thủ công." >&2
  exit 2
fi

unit="${units[0]}"
target="${targets[0]}"
if [[ "$target" != /opt/* || ! -f "$target" ]]; then
  echo "Dừng an toàn: đường dẫn worker không nằm trong /opt hoặc không tồn tại." >&2
  exit 2
fi

tmpdir="$(mktemp -d /tmp/ongthantai-worker.XXXXXX)"
backup_dir="/var/backups/ongthantai-telegram/member-sync"
install -d -m 0700 "$backup_dir"
backup="$(mktemp "$backup_dir/member_sync.py.$(date -u +%Y%m%dT%H%M%SZ).XXXXXX")"
staged="$target.new.$$"
cleanup() {
  rm -f "$staged"
  rm -f "$tmpdir/member_sync.py" "$tmpdir/__pycache__/"*.pyc
  rmdir "$tmpdir/__pycache__" 2>/dev/null || true
  rmdir "$tmpdir" 2>/dev/null || true
}
trap cleanup EXIT

curl -fsS "$REPO_RAW/member_sync.py" -o "$tmpdir/member_sync.py"
python3 -m py_compile "$tmpdir/member_sync.py"
rm -f "$tmpdir/__pycache__/member_sync.cpython-"*.pyc

cp -p "$target" "$backup"
install -o "$(stat -c '%u' "$target")" \
  -g "$(stat -c '%g' "$target")" \
  -m "$(stat -c '%a' "$target")" \
  "$tmpdir/member_sync.py" "$staged"
mv -f "$staged" "$target"

rollback() {
  local restore="$target.restore.$$"
  cp -p "$backup" "$restore"
  mv -f "$restore" "$target"
  systemctl restart "$unit" || true
  echo "Worker lỗi sau cập nhật; đã khôi phục bản sao lưu: $backup" >&2
}

if ! systemctl restart "$unit"; then
  rollback
  exit 1
fi

for _ in {1..10}; do
  systemctl is-active --quiet "$unit" && break
  sleep 1
done
if ! systemctl is-active --quiet "$unit"; then
  rollback
  exit 1
fi

echo "Đã cập nhật worker; service $unit đang active."
echo "Bản sao lưu: $backup"
