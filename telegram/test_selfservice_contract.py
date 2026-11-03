"""Regression checks for Telegram self-service staging endpoints.

Run: python3 -m unittest telegram/test_selfservice_contract.py
These tests inspect source without accessing Telegram, Supabase, or VPS.
"""
import ast
import pathlib
import unittest

SOURCE = pathlib.Path(__file__).with_name("telegram_login_flow.py")


class SelfServiceContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = SOURCE.read_text(encoding="utf-8")
        cls.tree = ast.parse(cls.source)

    def test_authenticated_group_routes_exist(self):
        for route in ('"/groups"', '"/groups/select"', '"/groups/selection"'):
            self.assertIn(route, self.source)
        for handler in ("list_available_groups", "select_groups", "get_group_selection"):
            self.assertIn(f"async def {handler}(uid: str = Depends(user_id))" if handler != "select_groups" else "async def select_groups(body: GroupSelectionRequest, uid: str = Depends(user_id))", self.source)

    def test_session_not_overwritten(self):
        self.assertIn("if target.exists():", self.source)
        self.assertIn("os.link(temporary, target)", self.source)
        finish = self.source.split("    async def finish(uid, entry):", 1)[1].split("    async def get_pending(", 1)[0]
        self.assertNotIn("os.replace(temporary, target)", finish)

    def test_session_write_cleanup_on_failure(self):
        finish = self.source.split("    async def finish(uid, entry):", 1)[1].split("    async def get_pending(", 1)[0]
        self.assertIn("finally:\n            pending.pop(uid, None)\n            await close_entry(entry)", finish)
        self.assertIn("os.link(temporary, target)", finish)
        self.assertLess(finish.index("        try:\n            if target.exists():"), finish.index("raise HTTPException(409"))
        self.assertIn("finally:\n            pending.pop(uid, None)\n            await close_entry(entry)", finish)

    def test_selected_groups_checked_against_telegram_membership(self):
        self.assertIn("set(selected).issubset(allowed)", self.source)
        self.assertIn('data.get("user_id") != uid', self.source)
        self.assertIn('"worker_started": False', self.source)

    def test_no_worker_started_by_api(self):
        self.assertNotIn("systemctl start", self.source)
        self.assertNotIn("subprocess.run", self.source)


if __name__ == "__main__":
    unittest.main()
