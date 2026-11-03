#!/usr/bin/env python3
"""Stage an isolated tenant config and SHA-256 sync-key registration instruction.

Operator-only; requires a previously migrated session. Does not write to Supabase
or start/restart any service. Never prints or stores the plaintext key outside
the mode-0600 tenant config. Use only after confirming license and consent.
"""
import argparse
import hashlib
import json
import os
import pwd
import re
import secrets
import stat
from pathlib import Path

BASE = Path("/var/lib/ongthantai-telegram/tenants")
CONFIG = Path("/etc/ongthantai-telegram/tenants")
SELECTIONS = Path("/var/lib/ongthantai-telegram-sessions")
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

def private(path):
    if path.is_symlink() or not path.is_file() or stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise RuntimeError("Unsafe or missing file: " + path.name)

def main(uid):
    if os.geteuid() != 0:
        raise PermissionError("Trusted VPS root required")
    if not UUID.fullmatch(uid):
        raise ValueError("Canonical UUID required")
    folder = BASE / uid
    session = folder / "telegram.session"
    private(session)
    selection = SELECTIONS / (uid + ".groups.json")
    private(selection)
    data = json.loads(selection.read_text())
    ids = data.get("allowed_chat_ids")
    if data.get("user_id") != uid or not isinstance(ids, list) or not ids or len(ids) > 200:
        raise RuntimeError("Invalid group consent")
    if any(type(v) is not int or abs(v) > 9999999999999999999 for v in ids) or len(set(ids)) != len(ids):
        raise RuntimeError("Invalid chat IDs")
    path = CONFIG / (uid + ".json")
    if path.exists() or path.is_symlink():
        raise FileExistsError("Existing tenant config; refusing overwrite")
    api_id = os.environ.get("TELEGRAM_API_ID")
    api_hash = os.environ.get("TELEGRAM_API_HASH")
    if not api_id or not api_hash:
        raise RuntimeError("Supply TELEGRAM_API_ID and TELEGRAM_API_HASH via protected environment")
    key = secrets.token_urlsafe(48)
    config = {"user_id": uid, "sync_key": key, "api_id": int(api_id),
              "api_hash": api_hash, "session_path": str(folder / "telegram"),
              "allowed_chat_ids": ids, "allowed_private_chat_ids": [],
              "receive_all_private": False}
    os.umask(0o077)
    CONFIG.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(config, output)
            output.flush()
            os.fsync(output.fileno())
        account = pwd.getpwnam("ongthantai-telegram")
        os.chown(path, account.pw_uid, account.pw_gid)
        os.chmod(path, 0o600)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    print("Tenant config staged:", uid[:8] + "…")
    print("Group count:", len(ids))
    print("SYNC_KEY_SHA256:", hashlib.sha256(key.encode()).hexdigest())
    print("Register this SHA-256 hash for the verified user in telegram_member_sync_keys.")
    print("DO NOT start worker until DB registration and license checks succeed.")
    print("No service was started and no database was modified.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", required=True)
    main(parser.parse_args().user_id)
