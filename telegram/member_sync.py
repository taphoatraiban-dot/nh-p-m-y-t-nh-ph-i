#!/usr/bin/env python3
"""Telegram member sync. Requires existing Telethon session and per-user sync key."""
import asyncio, json, os, urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from telethon import TelegramClient, events

BASE=Path("/var/lib/ongthantai-telegram")
QUEUE=BASE/"member_messages.jsonl"
CURSOR=BASE/"sync_cursor"
API="https://zigpqddlhvjbjrwhfhaa.supabase.co/functions/v1/telegram-member-sync?action=ingest"

def env(path):
    d={}
    for line in Path(path).read_text().splitlines():
        if "=" in line:
            k,v=line.split("=",1);d[k.strip()]=v.strip()
    return d

def send(user,key,groups,messages):
    payload=json.dumps({"groups":groups,"messages":messages},ensure_ascii=False).encode()
    req=urllib.request.Request(API,payload,headers={"Content-Type":"application/json","x-sync-user":user,"x-sync-key":key},method="POST")
    with urllib.request.urlopen(req,timeout=25) as resp:
        return json.load(resp)

async def main():
    os.umask(0o077)
    cfg=env("/etc/ongthantai-telegram/telegram.env")
    sync=env("/etc/ongthantai-telegram/member-sync.env")
    user=sync["SYNC_USER_ID"];key=sync["SYNC_KEY"]
    client=TelegramClient(str(BASE/"member"),int(cfg["TG_API_ID"]),cfg["TG_API_HASH"])
    await client.connect()
    if not await client.is_user_authorized():
        raise RuntimeError("Telegram session not authorized")
    groups={}
    async def refresh():
        groups.clear()
        async for d in client.iter_dialogs():
            if d.is_group:
                groups[d.id]=d.name
        return [{"chat_id":i,"group_name":n} for i,n in groups.items()]
    async def push(g,m):
        return await asyncio.to_thread(send,user,key,g,m)
    @client.on(events.NewMessage())
    async def received(e):
        if not e.is_group or not e.raw_text:return
        obj={"chat_id":e.chat_id,"message_id":e.id,"message_text":e.raw_text,"message_date":e.message.date.isoformat(),"sender_name":""}
        with QUEUE.open("a",encoding="utf8") as f:f.write(json.dumps(obj,ensure_ascii=False)+"\n")
        print("DA NHAN TIN:",groups.get(e.chat_id,e.chat_id),"ID",e.id,flush=True)
    print("TELEGRAM MEMBER SYNC START",flush=True)
    while True:
        try:
            current=await refresh()
            pos=int(CURSOR.read_text()) if CURSOR.exists() else 0
            if QUEUE.exists():
                with QUEUE.open("rb") as f:
                    f.seek(min(pos,QUEUE.stat().st_size))
                    for _ in range(20):
                        start=f.tell()
                        batch=[]
                        for _ in range(100):
                            line=f.readline()
                            if not line:break
                            try:batch.append(json.loads(line))
                            except json.JSONDecodeError:continue
                        if not batch:break
                        await push(current,batch)
                        CURSOR.write_text(str(f.tell()))
                        os.chmod(CURSOR,0o600)
            else:
                await push(current,[])
            print("DA DONG BO NHOM:",len(current),flush=True)
        except Exception as exc:
            print("LOI DONG BO:",type(exc).__name__,str(exc)[:180],flush=True)
        await asyncio.sleep(30)

asyncio.run(main())
