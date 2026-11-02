#!/usr/bin/env bash
set -euo pipefail
# LOCAL ONLY. Never link to a hosted Supabase project.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "== Phone password LOCAL smoke test =="
for tool in docker supabase node python3; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "THIẾU: $tool. Cài theo hướng dẫn chính thức rồi chạy lại."; exit 2
  fi
done
docker info >/dev/null 2>&1 || { echo "Docker Desktop chưa chạy."; exit 2; }
[[ -z "${SUPABASE_PROJECT_ID:-}" ]] || { echo "Không chạy khi có SUPABASE_PROJECT_ID."; exit 2; }
TESTDIR="$(mktemp -d "${TMPDIR:-/tmp}/cuncun-phone-local.XXXXXX")"
echo "Thư mục test: $TESTDIR"
cd "$TESTDIR"
supabase init
CONFIG="supabase/config.toml"
[[ -f "$CONFIG" ]] || { echo "Không tìm thấy config.toml"; exit 2; }
# Stop instead of guessing CLI config semantics; explicit user review is required.
echo "Đã tạo môi trường độc lập. Chưa gửi request và chưa tạo tài khoản."
echo "Mở $CONFIG, kiểm tra [auth.sms] enable_signup=true, enable_confirmations=false theo tài liệu Supabase hiện hành."
echo "Sau khi xác nhận, chạy: cd '$TESTDIR' && supabase start"
echo "Sau đó lấy LOCAL anon key bằng: supabase status"
echo "Chạy kiểm thử ở repo bằng LOCAL_PHONE_E2E=1 và các biến LOCAL_* trong MAC-MINI-LOCAL-TEST.md"
echo "Không chạy supabase link, db push, hoặc dùng project production."
