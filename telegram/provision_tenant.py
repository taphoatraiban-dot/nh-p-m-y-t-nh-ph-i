#!/usr/bin/env python3
"""Provision one customer Telegram session interactively on the trusted VPS.

Never pass Telegram OTP or 2FA passwords to the web client or GitHub.
Requires telethon and an authorized customer. The customer must consent.
"""
import argparse
import asyncio
import json
import os
import getpass
import uuid
from pathlib import Path
from telethon import TelegramClient

BASE=Path("/var/lib/ongthantai-telegram/tenants")
CONFIG=Path("/etc/ongthantai-telegram/tenants")

async def run(args):
    user=str(uuid.UUID(args.user_id))
    sync_key=getpass.getpass("Per-customer sync key (hidden): ").strip()
    if len(sync_key)<40: raise ValueError("Invalid sync key")
    os.umask(0o077)
    folder=BASE/user
    folder.mkdir(mode=0o700,parents=True,exist_ok=True)
    session=folder/"telegram"
    client=TelegramClient(str(session),args.api_id,args.api_hash)
    await client.start(phone=lambda:input("Customer phone (+country code): ").strip())
    dialogs=[]
    async for d in client.iter_dialogs():
        if d.is_group: dialogs.append((int(d.id),d.name))
    print("Available groups:")
    for i,(chat_id,name) in enumerate(dialogs,1):
        print(f"{i}. {name} ({chat_id})")
    print("Select numbers separated by commas; empty means no groups.")
    raw=input("Group numbers: ").strip()
    indices=set(int(p.strip()) for p in raw.split(",") if p.strip())
    if any(i<1 or i>len(dialogs) for i in indices):raise ValueError("Unknown group number")
    ids=[chat_id for i,(chat_id,_) in enumerate(dialogs,1) if i in indices]
    cfg={"user_id":user,"sync_key":sync_key,"api_id":args.api_id,
         "api_hash":args.api_hash,"session_path":str(session),"allowed_chat_ids":ids}
    CONFIG.mkdir(mode=0o700,parents=True,exist_ok=True)
    path=CONFIG/(user+".json")
    if path.exists():raise FileExistsError("Tenant already configured; do not overwrite a live session")
    flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL
    fd=os.open(path,flags,0o600)
    with os.fdopen(fd,"w") as f:json.dump(cfg,f,ensure_ascii=False)
    await client.disconnect()
    print("Provisioned:",path,"Groups:",len(ids))
    print("Start the isolated worker only after reviewing permissions and backend isolation.")

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--user-id",required=True)
    p.add_argument("--api-id",type=int,required=True)
    p.add_argument("--api-hash",required=True)
    asyncio.run(run(p.parse_args()))
