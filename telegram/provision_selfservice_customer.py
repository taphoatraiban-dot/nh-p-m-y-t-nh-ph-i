#!/usr/bin/env python3
"""Provision an explicitly consented Telegram tenant on the VPS.

Run as root in a trusted service with protected environment variables.
Never print secrets; fail closed on conflicting tenant or database state.
"""
import argparse
import fcntl
import hashlib
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

from migrate_selfservice_session import migrate
from stage_selfservice_tenant import main as stage
from verify_selfservice_tenant import run as verify

BASE = "https://zigpqddlhvjbjrwhfhaa.supabase.co/rest/v1/"
CONFIG = Path("/etc/ongthantai-telegram/tenants")
SESSION = Path("/var/lib/ongthantai-telegram/tenants")
SELECTION = Path("/var/lib/ongthantai-telegram-sessions")
UUID = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$")

def request(table, uid, key, method="GET", payload=None, fields="*"):
    params = urllib.parse.urlencode({"user_id": "eq." + uid, "select": fields})
    headers = {"apikey": key, "Authorization": "Bearer " + key,
               "Content-Type": "application/json"}
    data = json.dumps(payload).encode() if payload is not None else None
    if method == "POST":
        headers["Prefer"] = "return=minimal"
    url = BASE + table + (("?" + params) if method == "GET" else "")
    req = urllib.request.Request(url, headers=headers, data=data, method=method)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.load(resp) if method == "GET" else None

def eligible(uid, key):
    if request("admin_users", uid, key, fields="user_id"):
        return True
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    for table in ("licenses", "email_licenses"):
        for row in request(table, uid, key, fields="active,expires_at"):
            expiry = row.get("expires_at")
            if row.get("active") is True and (
                expiry is None or datetime.fromisoformat(expiry.replace("Z", "+00:00")) > now
            ):
                return True
    return False

def provision(uid):
    if os.geteuid() != 0 or not UUID.fullmatch(uid):
        raise RuntimeError("Trusted root and canonical UUID required")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise RuntimeError("Missing protected service credential")
    lock = Path("/run/lock/ongthantai-telegram-provision.lock")
    with lock.open("a+") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        if not eligible(uid, key):
            raise RuntimeError("Customer license not active; no provisioning")
        selected = SELECTION / (uid + ".groups.json")
        if not selected.is_file() or selected.is_symlink():
            raise RuntimeError("Missing customer group selection")
        groups = json.loads(selected.read_text())
        ids = groups.get("allowed_chat_ids")
        if groups.get("user_id") != uid or not isinstance(ids, list) or not ids:
            raise RuntimeError("Invalid group consent")
        config = CONFIG / (uid + ".json")
        session = SESSION / uid / "telegram.session"
        existing = request("telegram_member_sync_keys", uid, key, fields="secret_hash")
        if not session.exists():
            if config.exists() or existing:
                raise RuntimeError("Inconsistent existing tenant; manual review")
            migrate(uid)
        if not config.exists():
            if existing:
                raise RuntimeError("DB key exists without config; manual review")
            stage(uid)
        if config.is_symlink() or not config.is_file():
            raise RuntimeError("Unsafe tenant config")
        cfg = json.loads(config.read_text())
        if cfg.get("user_id") != uid or cfg.get("allowed_chat_ids") != ids:
            raise RuntimeError("Tenant group selection differs; manual review")
        digest = hashlib.sha256(cfg["sync_key"].encode()).hexdigest()
        existing = request("telegram_member_sync_keys", uid, key, fields="secret_hash")
        if existing:
            if len(existing) != 1 or existing[0].get("secret_hash") != digest:
                raise RuntimeError("Conflicting registered key; manual review")
        else:
            request("telegram_member_sync_keys", uid, key, method="POST",
                    payload={"user_id": uid, "secret_hash": digest})
        verify(uid)
        unit = "ongthantai-tenant@" + uid + ".service"
        subprocess.run(["systemctl", "start", unit], check=True, timeout=35)
        subprocess.run(["systemctl", "is-active", "--quiet", unit], check=True)
        print("PROVISIONED:", uid[:8] + "…", "GROUPS:", len(ids))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", required=True)
    provision(parser.parse_args().user_id)
