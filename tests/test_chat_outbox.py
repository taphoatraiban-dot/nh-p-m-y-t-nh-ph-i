import asyncio
import importlib.util
import pathlib
import sys
import tempfile
import types
import unittest
ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('chat_outbox', ROOT/'telegram/chat_outbox.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
class RPCError(Exception): pass
class Request:
    def __init__(self, **kw): self.__dict__.update(kw)
class ChatTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.modules = dict(sys.modules)
        sys.modules['telethon.tl.functions.messages'] = types.SimpleNamespace(SendMessageRequest=Request)
        sys.modules['telethon.errors'] = types.SimpleNamespace(RPCError=RPCError)
    def tearDown(self):
        for k in ['telethon.tl.functions.messages', 'telethon.errors']:
            if k in self.modules: sys.modules[k] = self.modules[k]
            else: sys.modules.pop(k, None)
    async def test_ack_failure_replays_receipt_without_resending(self):
        jobs=[{'id':'22222222-2222-4222-8222-222222222222','chat_id':-123,'message_text':'hi'}]
        cfg={'allowed_chat_ids':{-123},'allowed_private_chat_ids':set()}
        sent=[];acks=[]
        class Client:
            async def get_input_entity(self, chat): return chat
            async def __call__(self, request):
                sent.append(request)
                return types.SimpleNamespace(id=99,date=None)
        def request(cfg, action, body):
            if action=='claim': return {'jobs':jobs}
            acks.append(body)
            if len(acks)==1: raise OSError('ack offline')
            return {'success':True}
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(OSError): await m.process_jobs(Client(),cfg,tmp,request)
            await m.process_jobs(Client(),cfg,tmp,request)
            self.assertEqual(len(sent),1)
            self.assertEqual(acks[0],acks[1])
            self.assertEqual(acks[1]['message_id'],99)
    async def test_disallowed_chat_never_reaches_telegram(self):
        cfg={'allowed_chat_ids':set(),'allowed_private_chat_ids':set()};acks=[]
        def request(cfg, action, body):
            if action=='claim':return {'jobs':[{'id':'22222222-2222-4222-8222-222222222222','chat_id':-123,'message_text':'hi'}]}
            acks.append(body);return {'success':True}
        with tempfile.TemporaryDirectory() as tmp:await m.process_jobs(None,cfg,tmp,request)
        self.assertEqual(acks[0]['state'],'failed')
    async def test_uncertain_receipt_does_not_block_the_next_message(self):
        duplicate = type('RandomIdDuplicateError', (RPCError,), {})
        jobs=[{'id':'22222222-2222-4222-8222-222222222222','chat_id':-123,'message_text':'first'},
              {'id':'33333333-3333-4333-8333-333333333333','chat_id':-123,'message_text':'second'}]
        cfg={'allowed_chat_ids':{-123},'allowed_private_chat_ids':set()};acks=[]
        class Client:
            async def get_input_entity(self, chat): return chat
            async def __call__(self, req):
                if req.message=='first': raise duplicate('duplicate')
                return types.SimpleNamespace(id=100,date=None)
        def request(cfg, action, body):
            if action=='claim':return {'jobs':jobs}
            acks.append(body);return {'success':True}
        with tempfile.TemporaryDirectory() as tmp:await m.process_jobs(Client(),cfg,tmp,request)
        self.assertEqual(acks[0]['error'],'RECEIPT_UNCERTAIN')
        self.assertEqual(acks[1]['state'],'sent')

    def test_random_id_stable_and_private_opt_in(self):
        self.assertEqual(m.random_id('abc'),m.random_id('abc'))
        self.assertNotEqual(m.random_id('abc'),m.random_id('def'))
        cfg={'allowed_chat_ids':set(),'allowed_private_chat_ids':{123}}
        self.assertTrue(m.chat_allowed(cfg,123));self.assertFalse(m.chat_allowed(cfg,456));self.assertFalse(m.chat_allowed(cfg,-123))
if __name__=='__main__': unittest.main()
