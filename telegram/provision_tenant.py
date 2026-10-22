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
import pwd
from pathlib import Path
from telethon import TelegramClient

SERVICE_USER="ongthantai-telegram"
BASE=Path("/var/lib/ongthantai-telegram/tenants")
CONFIG=Path("/etc/ongthantai-telegram/tenants")

async def run(args):
    user=str(uuid.UUID(args.user_id))
    sync_key=getpass.getpass("Per-customer sync key (hidden): ").strip()
    if len(sync_key)<40: raise ValueError("Invalid sync key")
    if os.geteuid() != 0:
        raise PermissionError("Run provisioning as root on the trusted VPS; customer login stays interactive")
    service=pwd.getpwnam(SERVICE_USER)
    os.umask(0o077)
    folder=BASE/user
    folder.mkdir(mode=0o700,parents=True,exist_ok=True)
    session=folder/"telegram"
    # The isolated worker runs as the service user, not root.
    os.chown(folder,service.pw_uid,service.pw_gid)
    os.chmod(folder,0o700)
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
    private_dialogs=[]
    async for d in client.iter_dialogs():
        if d.is_user and not getattr(d.entity,"bot",False):
            private_dialogs.append((int(d.id),d.name))
    print("Available private conversations (opt-in only):")
    for i,(chat_id,name) in enumerate(private_dialogs,1):
        print(f"{i}. {name} ({chat_id})")
    print("Select private conversations separated by commas; empty selects NONE.")
    selected_private=input("Private conversation numbers: ").strip()
    private_indices=set(int(p.strip()) for p in selected_private.split(",") if p.strip())
    if any(i<1 or i>len(private_dialogs) for i in private_indices):
        raise ValueError("Unknown private conversation number")
    private_ids=[chat_id for i,(chat_id,_) in enumerate(private_dialogs,1) if i in private_indices]
    cfg={"user_id":user,"sync_key":sync_key,"api_id":args.api_id,
         "api_hash":args.api_hash,"session_path":str(session),"allowed_chat_ids":ids,
         "allowed_private_chat_ids":private_ids}
    CONFIG.mkdir(mode=0o750,parents=True,exist_ok=True)
    path=CONFIG/(user+".json")
    if path.exists():raise FileExistsError("Tenant already configured; do not overwrite a live session")
    flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL
    fd=os.open(path,flags,0o600)
    with os.fdopen(fd,"w") as f:json.dump(cfg,f,ensure_ascii=False)
    # Keep mode 0600 and make the worker the file owner (never group-readable).
    os.chown(path,service.pw_uid,service.pw_gid)
    os.chmod(path,0o600)
    await client.disconnect()
    for entry in folder.iterdir():
        if entry.is_file() and not entry.is_symlink():
            os.chown(entry,service.pw_uid,service.pw_gid)
            os.chmod(entry,0o600)
    print("Provisioned:",path,"Groups:",len(ids),"Private conversations:",len(private_ids))
    print("Start the isolated worker only after reviewing permissions and backend isolation.")

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--user-id",required=True)
    p.add_argument("--api-id",type=int)
    p.add_argument("--api-hash")
    args=p.parse_args()
    if args.api_id is None or not args.api_hash:
        env_path=Path("/etc/ongthantai-telegram/telegram.env")
        if env_path.stat().st_mode & 0o022:
            raise PermissionError("Telegram env must not be writable by group/others")
        values={}
        for line in env_path.read_text().splitlines():
            line=line.strip()
            if not line or line.startswith("#") or "=" not in line:continue
            key,value=line.split("=",1)
            key=key.strip().removeprefix("export ").strip()
            values[key]=value.strip().strip('"').strip("'")
        args.api_id=args.api_id or int(values["TG_API_ID"])
        args.api_hash=args.api_hash or values["TG_API_HASH"]
    asyncio.run(run(args))
