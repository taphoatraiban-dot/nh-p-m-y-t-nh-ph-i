"""Send generic, encrypted Web Push alerts. No Telegram message text is fetched."""
import json
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

API = 'https://zigpqddlhvjbjrwhfhaa.supabase.co/functions/v1/telegram-push'


def api(action, body):
    req = urllib.request.Request(API+'?action='+action,json.dumps(body).encode(),method='POST',
        headers={'Content-Type':'application/json','x-push-key':os.environ['OTT_PUSH_DISPATCH_KEY']})
    with urllib.request.urlopen(req,timeout=25) as response:
        result=json.load(response)
    if not result.get('success'):
        raise RuntimeError('Push API rejected request')
    return result


def deliver(job, send=None, acknowledge=api):
    from pywebpush import webpush, WebPushException
    send=send or webpush
    payload=json.dumps({'title':'ÔNG THẦN TÀI','body':'Có tin nhắn Telegram mới. Mở phần mềm để xem.',
        'tag':'ott-telegram-'+job['job_id'],'url':'/?openChat=1'},ensure_ascii=False)
    import uuid
    state_dir=Path(os.environ['STATE_DIRECTORY']);state_dir.mkdir(mode=0o700,exist_ok=True)
    receipt=state_dir/(str(uuid.UUID(job['job_id']))+'.json')
    if receipt.exists():
        state=json.loads(receipt.read_text())['state']
        acknowledge('ack',{'id':job['job_id'],'state':state})
        receipt.unlink(missing_ok=True)
        return state
    key=Path(os.environ['CREDENTIALS_DIRECTORY'])/'vapid.pem' 
    try:
        send(subscription_info={'endpoint':job['endpoint'],'keys':{'p256dh':job['p256dh'],'auth':job['auth_key']}},
             data=payload,vapid_private_key=str(key),vapid_claims={'sub':'https://cuncun.icu'},
             ttl=3600,timeout=12,headers={'Urgency':'high'})
        state='sent'
    except WebPushException as exc:
        code=getattr(getattr(exc,'response',None),'status_code',None)
        state='expired' if code in (404,410) else 'retry'
    except Exception:
        state='retry'
    if state in ('sent','expired'):
        temp=receipt.with_suffix('.next');temp.write_text(json.dumps({'state':state}));os.chmod(temp,0o600);os.replace(temp,receipt)
    acknowledge('ack',{'id':job['job_id'],'state':state})
    receipt.unlink(missing_ok=True)
    return state


def main():
    with ThreadPoolExecutor(max_workers=4) as pool:
        while True:
            try:
                jobs=api('claim',{}).get('jobs',[])
                for future in [pool.submit(deliver,job) for job in jobs]:
                    future.result()
            except Exception as exc:
                print('Background push:',type(exc).__name__,flush=True)
            time.sleep(10)

if __name__=='__main__':main()
