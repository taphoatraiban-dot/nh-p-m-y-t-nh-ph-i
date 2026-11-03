"""Read-only preflight for Telegram self-service tenant activation.

Run on VPS as root. Does not print secrets, alter sessions, create workers or touch Supabase.
"""
import argparse
import json
import os
import re
import stat
from pathlib import Path

SESSIONS = Path("/var/lib/ongthantai-telegram-sessions")
CONFIGS = Path("/etc/ongthantai-telegram/tenants")
TENANTS = Path("/var/lib/ongthantai-telegram/tenants")
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

def private_file(path):
    if path.is_symlink() or not path.is_file():
        raise RuntimeError("Missing or symlinked file: " + path.name)
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise RuntimeError("Unsafe permissions: " + path.name)

def inspect(uid):
    if not UUID.fullmatch(uid):
        raise ValueError("Expected canonical lowercase UUID")
    encrypted = SESSIONS / (uid + ".session.enc")
    selection = SESSIONS / (uid + ".groups.json")
    private_file(encrypted)
    private_file(selection)
    data = json.loads(selection.read_text())
    ids = data.get("allowed_chat_ids")
    if data.get("user_id") != uid or not isinstance(ids, list) or not ids or len(ids) > 200:
        raise ValueError("Invalid or empty group selection")
    if any(type(x) is not int or abs(x) > 9999999999999999999 for x in ids) or len(set(ids)) != len(ids):
        raise ValueError("Invalid or duplicate chat IDs")
    cfg = CONFIGS / (uid + ".json")
    if cfg.exists() or cfg.is_symlink():
        raise RuntimeError("Existing tenant config: refusing to replace")
    folder = TENANTS / uid
    if folder.exists() or folder.is_symlink():
        raise RuntimeError("Existing tenant directory: refusing to replace")
    print(json.dumps({"user": uid[:8] + "…", "session_encrypted": True,
                      "selected_groups": len(ids), "tenant_config_exists": False,
                      "tenant_directory_exists": False, "ready_for_provisioning_review": True}))
    print("PREFLIGHT ONLY: No worker was created or started.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", required=True)
    args = parser.parse_args()
    inspect(args.user_id)
