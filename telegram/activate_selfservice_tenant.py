#!/usr/bin/env python3
"""Safely activate a pre-provisioned Telegram tenant after read-only verification.

This does not provision secrets or modify Supabase. It only enables a new
systemd tenant instance when its config, session, license and sync-key match.
"""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path
from verify_selfservice_tenant import run as verify

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
CONFIG = Path("/etc/ongthantai-telegram/tenants")

def activate(uid, dry_run=False):
    if os.geteuid() != 0:
        raise PermissionError("Trusted VPS root required")
    if not UUID.fullmatch(uid):
        raise ValueError("Canonical user UUID required")
    verify(uid)
    unit = "ongthantai-tenant@" + uid + ".service"
    state = subprocess.run(["systemctl", "is-active", "--quiet", unit], check=False)
    if state.returncode == 0:
        print("ALREADY_ACTIVE:", uid[:8] + "…")
        return
    if dry_run:
        print("DRY_RUN: eligible to start", uid[:8] + "…")
        return
    subprocess.run(["systemctl", "start", unit], check=True, timeout=35)
    check = subprocess.run(["systemctl", "is-active", "--quiet", unit], check=False)
    if check.returncode != 0:
        raise RuntimeError("Worker did not remain active; inspect systemd journal")
    print("STARTED:", uid[:8] + "…")
    print("Note: service active does not prove Telegram messages were ingested.")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--user-id", required=True)
    p.add_argument("--start", action="store_true", help="Actually start the worker")
    args = p.parse_args()
    activate(args.user_id, dry_run=not args.start)
