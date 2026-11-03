#!/usr/bin/env python3
"""Read-only authorization gate before enabling a staged tenant worker.

Requires a trusted VPS process with SUPABASE_SERVICE_ROLE_KEY in its environment.
No secret values, message contents or personal data are printed.
Never changes Supabase, systemd, tenant config, or Telegram sessions.
"""
import argparse
import hashlib
import json
import os
import re
import stat
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PROJECT = "https://zigpqddlhvjbjrwhfhaa.supabase.co"
CONFIG = Path("/etc/ongthantai-telegram/tenants")
SESSION = Path("/var/lib/ongthantai-telegram/tenants")
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

def query(table, fields, uid, secret):
    params = urllib.parse.urlencode({"select": fields, "user_id": "eq." + uid, "limit": "10"})
    request = urllib.request.Request(PROJECT + "/rest/v1/" + table + "?" + params,
                                     headers={"apikey": secret, "Authorization": "Bearer " + secret})
    with urllib.request.urlopen(request, timeout=12) as response:
        return json.load(response)

def run(uid):
    if not UUID.fullmatch(uid):
        raise ValueError("Canonical UUID required")
    if os.geteuid() != 0:
        raise PermissionError("Run only in trusted VPS environment")
    secret = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not secret:
        raise RuntimeError("Protected Supabase service credential missing")
    config = CONFIG / (uid + ".json")
    if config.is_symlink() or not config.is_file() or stat.S_IMODE(config.stat().st_mode) != 0o600:
        raise RuntimeError("Tenant config absent or unsafe")
    cfg = json.loads(config.read_text())
    if cfg.get("user_id") != uid or cfg.get("session_path") != str(SESSION / uid / "telegram"):
        raise RuntimeError("Tenant ownership mismatch")
    key = cfg.get("sync_key")
    if not isinstance(key, str) or len(key) < 40:
        raise RuntimeError("Invalid tenant sync key")
    session = SESSION / uid / "telegram.session"
    if session.is_symlink() or not session.is_file() or stat.S_IMODE(session.stat().st_mode) & 0o077:
        raise RuntimeError("Missing or insecure isolated Telegram session")
    expected = hashlib.sha256(key.encode("utf-8")).hexdigest()
    keys = query("telegram_member_sync_keys", "secret_hash", uid, secret)
    if len(keys) != 1 or keys[0].get("secret_hash") != expected:
        raise RuntimeError("Supabase sync-key hash does not match this tenant")
    now = datetime.now(timezone.utc)
    active = bool(query("admin_users", "user_id", uid, secret))
    for table in ("email_licenses", "licenses"):
        for row in query(table, "active,expires_at", uid, secret):
            try:
                expiry_raw = row.get("expires_at")
                expiry = datetime.fromisoformat(expiry_raw.replace("Z", "+00:00")) if expiry_raw else None
                active |= row.get("active") is True and (expiry is None or expiry > now)
            except (KeyError, TypeError, AttributeError, ValueError):
                continue
    if not active:
        raise RuntimeError("No active license for this customer")
    print("READY: isolated session, sync-key hash and license verified for", uid[:8] + "…")
    print("READ-ONLY: worker not started.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", required=True)
    run(parser.parse_args().user_id)
