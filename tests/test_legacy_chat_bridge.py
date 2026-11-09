import asyncio
import importlib.util
import json
import pathlib
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'telegram'))
spec = importlib.util.spec_from_file_location('legacy_chat_bridge', ROOT/'telegram/legacy_chat_bridge.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
sys.path.pop(0)

class PolicyTests(unittest.TestCase):
    def test_all_private_is_explicit_and_excludes_service_chats(self):
        cfg={'receive_all_private':False,'allowed_private_chat_ids':{123}}
        self.assertTrue(m.private_chat_allowed(cfg,123))
        self.assertFalse(m.private_chat_allowed(cfg,456))
        cfg['receive_all_private']=True
        self.assertTrue(m.private_chat_allowed(cfg,456))
        for chat_id in [777000,42777,-123,0]:self.assertFalse(m.private_chat_allowed(cfg,chat_id))

class BridgeTests(unittest.IsolatedAsyncioTestCase):
    async def test_all_private_receives_new_human_messages_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp);config=root/'config.json'
            config.write_text(json.dumps({'enabled':True,'user_id':'admin','receive_all_private':True,'allowed_private_chat_ids':[]}))
            handlers=[]
            class Client:
                def add_event_handler(self, fn, event):handlers.append(fn)
                async def iter_dialogs(self):
                    if False:yield None
                def iter_messages(self,*args,**kwargs):raise AssertionError('Message history must not be read')
            async def sender(*args):await asyncio.Event().wait()
            def task_path(value):
                return config if str(value)=='/etc/ongthantai-telegram/chat-experiment.json' else pathlib.Path(value)
            async def event(chat_id,bot=False):
                async def get_chat():return types.SimpleNamespace(bot=bot,first_name='Test',last_name='')
                e=types.SimpleNamespace(is_private=True,chat_id=chat_id,raw_text='new test text',id=1,out=False,
                    message=types.SimpleNamespace(date=types.SimpleNamespace(isoformat=lambda:'2026-11-09T08:00:00Z'),edit_date=None),get_chat=get_chat)
                await handlers[0](e)
            fake=types.SimpleNamespace(events=types.SimpleNamespace(NewMessage=lambda:object(),MessageEdited=lambda:object()))
            with patch.object(m,'Path',side_effect=task_path),patch.object(m,'run_chat_outbox',sender),patch.dict(sys.modules,{'telethon':fake}):
                task=m.start_chat(Client(),'admin','private-key',{},root)
                await asyncio.sleep(0)
                try:
                    await event(456)
                    await event(777000)
                    await event(789,bot=True)
                    rows=[json.loads(s) for s in (root/'chat-private-pending.jsonl').read_text().splitlines()]
                    self.assertEqual(len(rows),1)
                    self.assertEqual(rows[0]['message']['chat_id'],456)
                finally:
                    task.cancel()
                    await asyncio.gather(task,return_exceptions=True)

if __name__=='__main__':unittest.main()
