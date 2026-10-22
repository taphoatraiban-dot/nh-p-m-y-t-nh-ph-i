#!/usr/bin/env python3
"""Isolated multi-tenant Telethon worker. Opt-in; legacy member_sync.py is untouched.

One process / Telegram session / sync key per licensed customer.
Usage: python3 telegram/tenant_worker.py --config /etc/ongthantai-telegram/tenants/<uuid>.json
The config file must be mode 0600 and contain:
{"user_id":"<Supabase auth UUID>","sync_key":"<per-user sync key>",
 "api_id":12345,"api_hash":"<Telegram API hash>",
 "session_path":"/var/lib/ongthantai-telegram/tenants/<uuid>/telegram",
 "allowed_chat_ids":[-1001234567890]}
The Telegram session MUST be authorized interactively beforehand under this tenant's
own account. Never share session files, API credentials or sync keys between tenants.
"""
import argparse
import asyncio
import json
import os
import stat
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from telethon import TelegramClient, events

ENDPOINT = "https://zigpqddlhvjbjrwhfhaa.supabase.co/functions/v1/telegram-member-sync?action=ingest"

def read_config(path):
    path = Path(path).resolve()
    if path.stat().st_mode & (stat.S_IRWXG | stat.S_IRWXO):
        raise PermissionError("Tenant config must not be readable by group/others (chmod 600)")
    data = json.loads(path.read_text())
    required = ("user_id", "sync_key", "api_id", "api_hash", "session_path", "allowed_chat_ids")
    if any(k not in data for k in required):
        raise ValueError("Missing tenant configuration")
    if not isinstance(data["allowed_chat_ids"], list):
        raise ValueError("allowed_chat_ids must be a list")
    data["allowed_chat_ids"] = set(map(int, data["allowed_chat_ids"]))
    session_path = Path(data["session_path"]).resolve()
    import uuid
    user_id = str(uuid.UUID(data["user_id"]))
    if user_id != data["user_id"]:
        raise ValueError("Noncanonical tenant user ID")
    expected = Path("/var/lib/ongthantai-telegram/tenants") / user_id / "telegram"
    if session_path != expected.resolve():
        raise ValueError("Session path must match the authenticated tenant ID")
    if not isinstance(data["sync_key"], str) or len(data["sync_key"]) < 40:
        raise ValueError("Invalid tenant sync key")
    return data, session_path

def ingest(cfg, groups, messages):
    payload = json.dumps({"groups": groups, "messages": messages}, ensure_ascii=False).encode()
    request = urllib.request.Request(
        ENDPOINT, payload, method="POST",
        headers={"Content-Type":"application/json",
                 "x-sync-user":cfg["user_id"], "x-sync-key":cfg["sync_key"]})
    with urllib.request.urlopen(request, timeout=25) as response:
        result = json.load(response)
        if not result.get("success"):
            raise RuntimeError("Ingest rejected")
        return result

async def main(path):
    os.umask(0o077)
    cfg, session = read_config(path)
    session.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    # A dedicated queue per tenant prevents cross-account mixing on transient API errors.
    queue_file = session.parent / "pending.jsonl"
    cursor_file = session.parent / "pending.cursor"
    async with TelegramClient(str(session), int(cfg["api_id"]), cfg["api_hash"]) as client:
        if not await client.is_user_authorized():
            raise RuntimeError("Tenant Telegram session not authorized; provision separately")
        async def publish(groups, messages):
            return await asyncio.to_thread(ingest, cfg, groups, messages)
        @client.on(events.NewMessage())
        async def receive(event):
            if event.is_group and event.raw_text and int(event.chat_id) in cfg["allowed_chat_ids"]:
                m={"chat_id":event.chat_id,"message_id":event.id,
                   "message_text":event.raw_text,"message_date":event.message.date.isoformat(),
                   "sender_name":""}
                with queue_file.open("a",encoding="utf-8") as handle:
                    handle.write(json.dumps(m,ensure_ascii=False)+"\n")
        while True:
            try:
                groups=[]
                async for dialog in client.iter_dialogs():
                    if dialog.is_group and int(dialog.id) in cfg["allowed_chat_ids"]:
                        groups.append({"chat_id":dialog.id,"group_name":dialog.name})
                if queue_file.exists() and queue_file.stat().st_size:
                    # Never truncate: a concurrent Telegram event may append during upload.
                    # Durable offset is committed only after successful acknowledgement.
                    offset=int(cursor_file.read_text()) if cursor_file.exists() else 0
                    with queue_file.open("rb") as stream:
                        stream.seek(min(offset,queue_file.stat().st_size))
                        while True:
                            batch=[]
                            for _ in range(100):
                                line=stream.readline()
                                if not line:break
                                try:batch.append(json.loads(line.decode("utf-8")))
                                except (ValueError,UnicodeError):continue
                            if not batch:break
                            await publish(groups,batch)
                            next_offset=stream.tell()
                            temp=cursor_file.with_suffix(".tmp")
                            temp.write_text(str(next_offset))
                            os.replace(temp,cursor_file)
                await publish(groups,[])
            except Exception as exc:
                print("Tenant sync failed:",type(exc).__name__,str(exc)[:160],flush=True)
            await asyncio.sleep(30)

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--config",required=True)
    args=parser.parse_args()
    asyncio.run(main(args.config))
