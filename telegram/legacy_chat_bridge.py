"""Optional Chat bridge for the existing administrator listener.

The original group listener and its durable queue keep running unchanged.
Private conversations require an explicit allowlist or administrator opt-in to all personal chats.
"""
import asyncio
import json
import os
import urllib.request
from pathlib import Path

from chat_outbox import run_chat_outbox


# Telegram authentication/service inboxes are not personal conversations.
SERVICE_CHAT_IDS = {777000, 42777}

def private_chat_allowed(cfg, chat_id):
    return (type(chat_id) is int and chat_id > 0 and chat_id not in SERVICE_CHAT_IDS
            and (cfg.get('receive_all_private') is True or chat_id in cfg['allowed_private_chat_ids']))


def start_chat(client, user, key, groups, session_dir):
    path = Path('/etc/ongthantai-telegram/chat-experiment.json')
    if not path.exists():
        return None
    settings = json.loads(path.read_text())
    if settings.get('enabled') is not True or settings.get('user_id') != user:
        return None
    private_ids = settings.get('allowed_private_chat_ids', [])
    if not isinstance(private_ids, list) or any(type(v) is not int or v <= 0 for v in private_ids):
        raise ValueError('Invalid private Chat allowlist')
    all_private = settings.get('receive_all_private', False)
    if not isinstance(all_private, bool):
        raise ValueError('receive_all_private must be boolean')
    cfg = {'user_id': user, 'sync_key': key, 'allowed_chat_ids': groups,
           'allowed_private_chat_ids': set(private_ids), 'receive_all_private': all_private}
    print('Telegram Chat bridge enabled for administrator', flush=True)
    if private_ids or all_private:
        # Separate private queue: group cursor, history recovery, and imports are untouched.
        from telethon import events
        queue = Path(session_dir) / 'chat-private-pending.jsonl'
        cursor = Path(session_dir) / 'chat-private.cursor'

        async def receive(event):
            if not event.is_private or not private_chat_allowed(cfg, int(event.chat_id)):
                return
            if not event.raw_text or len(event.raw_text) > 20000:
                return
            chat = await event.get_chat()
            if chat is None or getattr(chat, 'bot', False):
                return
            name = ' '.join(filter(None, [getattr(chat, 'first_name', None), getattr(chat, 'last_name', None)]))
            message = {'chat_id': event.chat_id, 'message_id': event.id,
                       'message_text': event.raw_text, 'message_date': event.message.date.isoformat(),
                       'sender_name': 'Đã gửi' if event.out else 'Đã nhận'}
            if event.message.edit_date:
                message['edited_at'] = event.message.edit_date.isoformat()
            with queue.open('a', encoding='utf-8') as stream:
                stream.write(json.dumps({'group': {'chat_id': event.chat_id,
                    'group_name': ('Cá nhân: ' + (name or str(event.chat_id)))[:200]},
                    'message': message}, ensure_ascii=False) + '\n')

        client.add_event_handler(receive, events.NewMessage())
        client.add_event_handler(receive, events.MessageEdited())

        def publish(batch, known_groups=None):
            by_chat = {x['chat_id']: x for x in (known_groups or [])}
            by_chat.update({x['group']['chat_id']: x['group'] for x in batch})
            request = urllib.request.Request(
                'https://zigpqddlhvjbjrwhfhaa.supabase.co/functions/v1/telegram-member-sync?action=ingest',
                json.dumps({'groups': list(by_chat.values()), 'messages': [x['message'] for x in batch]}).encode(),
                method='POST', headers={'Content-Type': 'application/json', 'x-sync-user': user, 'x-sync-key': key})
            with urllib.request.urlopen(request, timeout=25) as response:
                if not json.load(response).get('success'):
                    raise RuntimeError('Private Chat ingest rejected')

        async def pump_private():
            while True:
                try:
                    if queue.exists():
                        try:
                            offset = int(cursor.read_text()) if cursor.exists() else 0
                        except (OSError, ValueError):
                            offset = 0
                        if not 0 <= offset <= queue.stat().st_size:
                            offset = 0
                        with queue.open('rb') as stream:
                            stream.seek(offset)
                            batch = []
                            for _ in range(100):
                                line = stream.readline()
                                if not line:
                                    break
                                batch.append(json.loads(line))
                            if batch:
                                await asyncio.to_thread(publish, batch)
                                temp = cursor.with_suffix('.tmp')
                                temp.write_text(str(stream.tell()))
                                os.replace(temp, cursor)
                except Exception as exc:
                    print('Private Chat sync:', type(exc).__name__, flush=True)
                await asyncio.sleep(15)

        async def refresh_private_dialogs():
            while True:
                try:
                    metadata = []
                    async for dialog in client.iter_dialogs():
                        if (not dialog.is_user or getattr(dialog.entity, 'bot', False)
                                or not private_chat_allowed(cfg, int(dialog.id))):
                            continue
                        name = dialog.name or getattr(dialog.entity, 'username', None) or str(dialog.id)
                        metadata.append({'chat_id': int(dialog.id), 'group_name': ('Cá nhân: ' + name)[:200]})
                    for start in range(0, len(metadata), 300):
                        # Publish names/IDs only. Do not read or import message history.
                        await asyncio.to_thread(publish, [], metadata[start:start + 300])
                    print('Private Chat conversations registered:', len(metadata), flush=True)
                except Exception as exc:
                    print('Private Chat discovery:', type(exc).__name__, flush=True)
                await asyncio.sleep(120)

        private_task = asyncio.create_task(pump_private())
        metadata_task = asyncio.create_task(refresh_private_dialogs())
        # Keep tasks referenced for the lifetime of the sender task.
        async def together():
            try:
                await run_chat_outbox(client, cfg, session_dir)
            finally:
                private_task.cancel()
                metadata_task.cancel()
                await asyncio.gather(private_task, metadata_task, return_exceptions=True)
        return asyncio.create_task(together())
    return asyncio.create_task(run_chat_outbox(client, cfg, session_dir))
