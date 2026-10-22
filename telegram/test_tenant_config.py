#!/usr/bin/env python3
"""Offline deployment checks for isolated Telegram tenant worker.
Run on VPS or locally: python3 telegram/test_tenant_config.py
Requires telethon installed; makes no Telegram or Supabase network calls.
"""
import json
import os
import stat
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch
from tenant_worker import read_config

class TenantConfigTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.user = str(uuid.uuid4())
        self.valid = {
            "user_id": self.user, "sync_key": "s" * 64,
            "api_id": 12345, "api_hash": "placeholder",
            "session_path": f"/var/lib/ongthantai-telegram/tenants/{self.user}/telegram",
            "allowed_chat_ids": [-1001234567890]
        }
    def check(self, obj, should_pass=True):
        path = Path(self.temp.name) / "tenant.json"
        path.write_text(json.dumps(obj))
        os.chmod(path, 0o600)
        if should_pass:
            cfg, session = read_config(path)
            self.assertEqual(cfg["user_id"], self.user)
            self.assertEqual(session, Path(self.valid["session_path"]))
        else:
            with self.assertRaises((ValueError, PermissionError)):
                read_config(path)
    def test_valid(self): self.check(self.valid)
    def test_cross_tenant_path_rejected(self):
        obj = dict(self.valid)
        obj["session_path"] = f"/var/lib/ongthantai-telegram/tenants/{uuid.uuid4()}/telegram"
        self.check(obj, False)
    def test_prefix_traversal_rejected(self):
        obj = dict(self.valid)
        obj["session_path"] = self.valid["session_path"] + "-other"
        self.check(obj, False)
    def test_short_key_rejected(self):
        obj = dict(self.valid)
        obj["sync_key"] = "short"
        self.check(obj, False)
    def test_world_readable_config_rejected(self):
        path = Path(self.temp.name) / "insecure.json"
        path.write_text(json.dumps(self.valid))
        os.chmod(path, 0o644)
        with self.assertRaises(PermissionError):
            read_config(path)

if __name__ == "__main__":
    unittest.main()
