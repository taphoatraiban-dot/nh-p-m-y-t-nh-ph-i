"""Opt-in chat sender. No session, key, or business calculations are shared."""
import asyncio
import hashlib
import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def random_id(job_id):
    """Stable signed 64-bit MTProto ID, even after a crash or an expired lease."""
    return int.from_bytes(hashlib.sha256(job_id.encode()).digest()[:8], 'big', signed=True)


def chat_request(cfg, action, body):
    endpoint = cfg.get('chat_endpoint') or cfg.get('member_sync_endpoint', 'https://zigpqddlhvjbjrwhfhaa.supabase.co/functions/v1/telegram-member-sync?action=ingest').split('/functions/v1/')[0] + '/functions/v1/telegram-chat'
    req = urllib.request.Request(endpoint + '?action=' + action,
        json.dumps(body, ensure_ascii=False).encode(), method='POST',
        headers={'Content-Type': 'application/json', 'x-sync-user': cfg['user_id'], 'x-sync-key': cfg['sync_key']})
    with urllib.request.urlopen(req, timeout=25) as response:
        result = json.load(response)
    if not result.get('success'):
        raise RuntimeError('Chat API rejected request')
    return result


def chat_allowed(cfg, chat_id):
    return chat_id in cfg['allowed_chat_ids'] or (chat_id > 0 and
        (cfg.get('receive_all_private', False) or chat_id in cfg['allowed_private_chat_ids']))


async def process_jobs(client, cfg, session_dir, request=chat_request):
    # Import lazily so unit tests do not require a live Telegram installation.
    from telethon.tl.functions.messages import SendMessageRequest
    from telethon.errors import RPCError
    jobs = (await asyncio.to_thread(request, cfg, 'claim', {})).get('jobs', [])
    receipts = Path(session_dir) / 'chat-receipts'
    receipts.mkdir(mode=0o700, exist_ok=True)
    for job in jobs:
        import uuid
        job_id = str(uuid.UUID(job['id']))
        path = receipts / (job_id + '.json')
        if path.exists():
            ack = json.loads(path.read_text())
        elif not chat_allowed(cfg, int(job['chat_id'])):
            ack = {'id': job_id, 'state': 'failed', 'error': 'Hội thoại chưa được cấp quyền trên VPS'}
        else:
            try:
                entity = await client.get_input_entity(int(job['chat_id']))
                result = await client(SendMessageRequest(peer=entity, message=job['message_text'],
                    random_id=random_id(job_id), no_webpage=True))
                message_id = getattr(result, 'id', None)
                date = getattr(result, 'date', None)
                for update in getattr(result, 'updates', []):
                    if getattr(update, 'random_id', None) == random_id(job_id):
                        message_id = update.id
                    msg = getattr(update, 'message', None)
                    if msg is not None and getattr(msg, 'out', False):
                        message_id = message_id or msg.id
                        date = date or msg.date
                if not message_id:
                    # An accepted request without a receipt needs human reconciliation.
                    ack = {'id': job_id, 'state': 'failed', 'error': 'RECEIPT_UNCERTAIN'}
                else:
                    ack = {'id': job_id, 'state': 'sent', 'message_id': int(message_id),
                        'message_date': (date or datetime.now(timezone.utc)).isoformat()}
            except RPCError as exc:
                # A duplicate random ID may mean the earlier send succeeded before a crash.
                ack = {'id': job_id, 'state': 'failed', 'error':
                    'RECEIPT_UNCERTAIN' if type(exc).__name__ == 'RandomIdDuplicateError' else type(exc).__name__}
        # Save before ack: temporary API failures must not send a new Telegram message.
        tmp = path.with_suffix('.tmp')
        tmp.write_text(json.dumps(ack))
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)
        await asyncio.to_thread(request, cfg, 'ack', ack)
        path.unlink(missing_ok=True)
    return len(jobs)


async def run_chat_outbox(client, cfg, session_dir):
    delay = 3
    while True:
        try:
            count = await process_jobs(client, cfg, session_dir)
            delay = 3 if count else min(30, delay * 2)
        except Exception as exc:
            print('Telegram chat queue:', type(exc).__name__, flush=True)
        await asyncio.sleep(delay)
