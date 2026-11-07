"""Regression checks for private Telegram opt-in and direction labels.

Run: python3 -m unittest discover -s tests -p 'test_telegram_private.py'
No Telegram credentials or network required.
"""
import ast
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "telegram" / "tenant_worker.py").read_text(encoding="utf-8")
TREE = ast.parse(SOURCE)
NAMES = {"private_chat_allowed", "private_direction"}
FUNCTIONS = [node for node in TREE.body if isinstance(node, ast.FunctionDef) and node.name in NAMES]
NAMESPACE = {}
exec(compile(ast.Module(body=FUNCTIONS, type_ignores=[]), "<private-policy>", "exec"), NAMESPACE)

class TelegramPrivatePolicyTests(unittest.TestCase):
    def test_default_private_disabled(self):
        cfg = {"receive_all_private": False, "allowed_private_chat_ids": set()}
        self.assertFalse(NAMESPACE["private_chat_allowed"](cfg, 123))

    def test_allowlist_private_only(self):
        cfg = {"receive_all_private": False, "allowed_private_chat_ids": {123}}
        self.assertTrue(NAMESPACE["private_chat_allowed"](cfg, 123))
        self.assertFalse(NAMESPACE["private_chat_allowed"](cfg, 456))

    def test_all_private_opt_in(self):
        cfg = {"receive_all_private": True, "allowed_private_chat_ids": set()}
        self.assertTrue(NAMESPACE["private_chat_allowed"](cfg, 456))

    def test_handlers_include_outgoing_private(self):
        # Both handlers must accept private messages regardless of event.out.
        worker = next(node for node in TREE.body if isinstance(node, ast.AsyncFunctionDef) and node.name == "main")
        handlers = {node.name: node for node in ast.walk(worker) if isinstance(node, ast.AsyncFunctionDef)}
        for name in ("receive", "receive_edit"):
            source = ast.get_source_segment(SOURCE, handlers[name])
            self.assertIn("private_chat_allowed(cfg,event.chat_id)", source)
            self.assertNotIn("not event.out", source)
            self.assertIn("private_direction(event.out)", source)

    def test_group_allowlist_unchanged(self):
        worker = next(node for node in TREE.body if isinstance(node, ast.AsyncFunctionDef) and node.name == "main")
        handlers = {node.name: node for node in ast.walk(worker) if isinstance(node, ast.AsyncFunctionDef)}
        for name in ("receive", "receive_edit"):
            source = ast.get_source_segment(SOURCE, handlers[name])
            self.assertIn('int(event.chat_id) in cfg["allowed_chat_ids"]', source)

    def test_private_bot_edits_are_filtered(self):
        worker = next(node for node in TREE.body if isinstance(node, ast.AsyncFunctionDef) and node.name == "main")
        handler = next(node for node in ast.walk(worker) if isinstance(node, ast.AsyncFunctionDef) and node.name == "receive_edit")
        source = ast.get_source_segment(SOURCE, handler)
        self.assertIn("if private_allowed:", source)
        self.assertIn('getattr(sender, "bot", False)', source)

    def test_both_directions(self):
        self.assertEqual(NAMESPACE["private_direction"](True), "Đã gửi")
        self.assertEqual(NAMESPACE["private_direction"](False), "Đã nhận")

if __name__ == "__main__":
    unittest.main()
