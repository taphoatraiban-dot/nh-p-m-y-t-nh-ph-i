#!/usr/bin/env python3
"""Convert a consented, encrypted self-service StringSession to an isolated SQLite tenant session.

Operator-only migration stage. Does NOT create config, keys or start systemd.
Run on trusted VPS as root with TELEGRAM_SESSION_KEY and service account available.
No secrets or session material are printed.
"""
import argparse
import json
import os
import pwd
import re
import stat
import tempfile
from pathlib import Path
from cryptography.fernet import Fernet
from telethon.sessions import StringSession, SQLiteSession

SOURCE = Path("/var/lib/ongthantai-telegram-sessions")
DEST = Path("/var/lib/ongthantai-telegram/tenants")
UID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

def check_private(path):
    if path.is_symlink() or not path.is_file() or stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise RuntimeError("Source missing, symlinked, or insecure: " + path.name)

def migrate(uid):
    if os.geteuid() != 0:
        raise PermissionError("Trusted VPS root required")
    if not UID.fullmatch(uid):
        raise ValueError("Invalid canonical user UUID")
    key = os.environ.get("TELEGRAM_SESSION_KEY")
    if not key:
        raise RuntimeError("TELEGRAM_SESSION_KEY must be supplied securely")
    src = SOURCE / (uid + ".session.enc")
    selected = SOURCE / (uid + ".groups.json")
    check_private(src)
    check_private(selected)
    selection = json.loads(selected.read_text())
    ids = selection.get("allowed_chat_ids")
    if selection.get("user_id") != uid or not isinstance(ids, list) or not ids:
        raise RuntimeError("Missing explicit group selection")
    if len(ids) > 200 or len(ids) != len(set(ids)) or any(type(i) is not int for i in ids):
        raise RuntimeError("Invalid group selection")
    dest = DEST / uid
    if dest.exists() or dest.is_symlink():
        raise FileExistsError("Tenant directory already exists; refusing overwrite")
    if (Path("/etc/ongthantai-telegram/tenants") / (uid + ".json")).exists():
        raise FileExistsError("Tenant config already exists; refusing overwrite")
    value = Fernet(key.encode("ascii")).decrypt(src.read_bytes()).decode("utf-8")
    source_session = StringSession(value)
    if not source_session.auth_key or not source_session.dc_id:
        raise RuntimeError("Invalid Telegram StringSession")
    account = pwd.getpwnam("ongthantai-telegram")
    os.umask(0o077)
    DEST.mkdir(parents=True, exist_ok=True)
    # Stage in the same filesystem and atomically rename only on success.
    with tempfile.TemporaryDirectory(prefix=".tenant-stage-", dir=DEST) as staging:
        stage = Path(staging)
        sqlite = SQLiteSession(str(stage / "telegram"))
        try:
            sqlite.set_dc(source_session.dc_id, source_session.server_address, source_session.port)
            sqlite.auth_key = source_session.auth_key
            sqlite.save()
        finally:
            sqlite.close()
        for file in stage.iterdir():
            if not file.is_file() or file.is_symlink():
                raise RuntimeError("Unexpected staging content")
            os.chown(file, account.pw_uid, account.pw_gid)
            os.chmod(file, 0o600)
        os.chown(stage, account.pw_uid, account.pw_gid)
        os.chmod(stage, 0o700)
        os.rename(stage, dest)
    print("Session migration complete for:", uid[:8] + "…")
    print("Group selection count:", len(ids))
    print("No sync key/config created; no worker started.")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--user-id", required=True)
    migrate(p.parse_args().user_id)
