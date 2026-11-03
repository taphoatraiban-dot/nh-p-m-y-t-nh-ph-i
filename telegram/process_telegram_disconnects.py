#!/usr/bin/env python3
"""Process authenticated Telegram disconnect markers; root-only, fail closed."""
import os
import fcntl
import re
import shutil
import stat
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

SOURCE = Path("/var/lib/ongthantai-telegram-sessions")
TENANTS = Path("/var/lib/ongthantai-telegram/tenants")
CONFIG = Path("/etc/ongthantai-telegram/tenants")
UUID = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$")
BASE = "https://zigpqddlhvjbjrwhfhaa.supabase.co/rest/v1/"

def private_regular(path):
    if path.is_symlink() or (path.exists() and not path.is_file()):
        raise RuntimeError("Unexpected file type")
    if path.exists() and stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise RuntimeError("Unsafe file permissions")

def disconnect(uid):
    lock_path = Path("/run/lock/ongthantai-telegram-provision.lock")
    with lock_path.open("a+") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        return disconnect_locked(uid)

def disconnect_locked(uid):
    if os.geteuid() != 0 or not UUID.fullmatch(uid):
        raise RuntimeError("Root and canonical UUID required")
    marker = SOURCE / (uid + ".revoked")
    private_regular(marker)
    if not marker.is_file() or marker.read_text().strip() != uid:
        raise RuntimeError("Invalid revocation marker")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise RuntimeError("Missing protected service credential")
    # Stop first: no further messages may be delivered with the old key.
    unit = "ongthantai-tenant@" + uid + ".service"
    subprocess.run(["systemctl", "stop", unit], check=True, timeout=45)
    if subprocess.run(["systemctl", "is-active", "--quiet", unit], check=False).returncode == 0:
        raise RuntimeError("Worker is still active")
    # Revoke backend authorization before deleting local credentials.
    query = urllib.parse.urlencode({"user_id": "eq." + uid})
    request = urllib.request.Request(BASE + "telegram_member_sync_keys?" + query,
        headers={"apikey": key, "Authorization": "Bearer " + key},
        method="DELETE")
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status not in (200, 204):
            raise RuntimeError("Unable to revoke sync key")
    for path in (CONFIG / (uid + ".json"),
                 SOURCE / (uid + ".groups.json"),
                 SOURCE / (uid + ".session.enc")):
        private_regular(path)
        path.unlink(missing_ok=True)
    tenant_dir = TENANTS / uid
    if tenant_dir.is_symlink():
        raise RuntimeError("Unsafe tenant directory")
    if tenant_dir.exists():
        if not tenant_dir.is_dir():
            raise RuntimeError("Unexpected tenant directory type")
        shutil.rmtree(tenant_dir)
    marker.unlink()
    print("DISCONNECTED:", uid[:8] + "…")

def main():
    ok = errors = 0
    for marker in sorted(SOURCE.glob("*.revoked")):
        uid = marker.name.removesuffix(".revoked")
        if not UUID.fullmatch(uid):
            continue
        try:
            disconnect(uid)
            ok += 1
        except Exception as exc:
            errors += 1
            print("DISCONNECT_RETRY:", uid[:8] + "…", type(exc).__name__)
    print("DISCONNECT_SCAN:", ok, "completed;", errors, "retrying")

if __name__ == "__main__":
    main()
