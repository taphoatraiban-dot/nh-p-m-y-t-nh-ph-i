import importlib.util
import json
import os
import pathlib
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('push_dispatcher',ROOT/'telegram/push_dispatcher.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class WebPushException(Exception): pass
class PushTests(unittest.TestCase):
 def test_generic_payload_and_durable_receipt_avoid_duplicate_after_ack_failure(self):
  job={'job_id':'11111111-1111-4111-8111-111111111111','endpoint':'https://fcm.googleapis.com/test','p256dh':'test','auth_key':'test','message_text':'must stay private'};sends=[];acks=[]
  def send(**kwargs):sends.append(kwargs)
  def ack(action,body):
   acks.append(body)
   if len(acks)==1:raise OSError('offline')
  with tempfile.TemporaryDirectory() as tmp,patch.dict(os.environ,{'STATE_DIRECTORY':tmp,'CREDENTIALS_DIRECTORY':tmp}),patch.dict(sys.modules,{'pywebpush':types.SimpleNamespace(webpush=send,WebPushException=WebPushException)}):
   with self.assertRaises(OSError):m.deliver(job,send,ack)
   self.assertEqual(m.deliver(job,send,ack),'sent')
   self.assertEqual(len(sends),1);self.assertNotIn('must stay private',sends[0]['data']);self.assertEqual(acks[0],acks[1])
 def test_expired_push_endpoint_is_disabled(self):
  job={'job_id':'22222222-2222-4222-8222-222222222222','endpoint':'https://fcm.googleapis.com/test','p256dh':'test','auth_key':'test'};acks=[]
  def send(**kwargs):
   e=WebPushException();e.response=types.SimpleNamespace(status_code=410);raise e
  with tempfile.TemporaryDirectory() as tmp,patch.dict(os.environ,{'STATE_DIRECTORY':tmp,'CREDENTIALS_DIRECTORY':tmp}),patch.dict(sys.modules,{'pywebpush':types.SimpleNamespace(webpush=send,WebPushException=WebPushException)}):
   self.assertEqual(m.deliver(job,send,lambda action,body:acks.append(body)),'expired');self.assertEqual(acks[0]['state'],'expired')
if __name__=='__main__':unittest.main()
