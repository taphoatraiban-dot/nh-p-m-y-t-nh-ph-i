"""Isolated Telegram OTP flow; NOT mounted in the running API until VPS rollout.

Requires telethon==1.45.0, cryptography, TELEGRAM_API_ID, TELEGRAM_API_HASH,
TELEGRAM_SESSION_KEY (Fernet), TELEGRAM_SESSION_DIR (chmod 0700).
Mount with create_router(require_licensed_user) AFTER checking identity/license.
Single uvicorn worker; use durable, shared expiring state before scaling.
"""
import asyncio
import os
import re
import secrets
import time
from pathlib import Path

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from telethon import TelegramClient
from telethon.errors import (
    FloodWaitError, PhoneCodeExpiredError, PhoneCodeInvalidError,
    SessionPasswordNeededError, PasswordHashInvalidError,
)
from telethon.sessions import StringSession

PHONE = re.compile(r"^\+[1-9][0-9]{7,14}$")
UUID = re.compile(r"^[a-f0-9-]{36}$")
TTL = 300
pending = {}
cooldown = {}
lock = asyncio.Lock()

class StartRequest(BaseModel):
    phone: str = Field(max_length=16)

class ConfirmRequest(BaseModel):
    code: str = Field(min_length=3, max_length=12)

class PasswordRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)

def create_router(require_licensed_user):
    router = APIRouter(prefix="/telegram-login", tags=["telegram-login"])
    api_id = int(os.environ["TELEGRAM_API_ID"])
    api_hash = os.environ["TELEGRAM_API_HASH"]
    cipher = Fernet(os.environ["TELEGRAM_SESSION_KEY"].encode("ascii"))
    directory = Path(os.environ.get("TELEGRAM_SESSION_DIR", "/var/lib/ongthantai-telegram-sessions"))
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if directory.stat().st_mode & 0o077:
        raise RuntimeError("Session directory must not be accessible by group or others")

    def path_for(uid):
        if not UUID.fullmatch(uid):
            raise HTTPException(401, "Invalid user")
        return directory / (uid + ".session.enc")

    async def user_id(user=Depends(require_licensed_user)):
        # Auth dependency MUST validate current Supabase JWT and active license.
        uid = user if isinstance(user, str) else user.get("id", "")
        if not UUID.fullmatch(uid):
            raise HTTPException(401, "Invalid identity")
        return uid

    async def close_entry(entry):
        if entry:
            try:
                await entry["client"].disconnect()
            except Exception:
                pass

    async def finish(uid, entry):
        value = entry["client"].session.save()
        encrypted = cipher.encrypt(value.encode("utf-8"))
        target = path_for(uid)
        temporary = target.with_name(target.name + "." + secrets.token_hex(8) + ".tmp")
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, "wb") as output:
                output.write(encrypted)
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
        pending.pop(uid, None)
        await close_entry(entry)

    async def get_pending(uid, expected):
        entry = pending.get(uid)
        if not entry or entry["expires"] < time.monotonic() or entry["state"] != expected:
            pending.pop(uid, None)
            await close_entry(entry)
            raise HTTPException(409, "Login session expired; start again")
        return entry

    @router.post("/start")
    async def start(body: StartRequest, uid: str = Depends(user_id)):
        if not PHONE.fullmatch(body.phone):
            raise HTTPException(400, "Use international format, e.g. +849xxxxxxxx")
        async with lock:
            now = time.monotonic()
            if cooldown.get(uid, 0) > now:
                raise HTTPException(429, "Please wait before requesting another code")
            cooldown[uid] = now + 60
            old = pending.pop(uid, None)
            await close_entry(old)
            client = TelegramClient(StringSession(), api_id, api_hash)
            try:
                await client.connect()
                sent = await client.send_code_request(body.phone)
            except FloodWaitError:
                await client.disconnect()
                raise HTTPException(429, "Telegram rate limited the request")
            except Exception:
                await client.disconnect()
                raise HTTPException(502, "Unable to request Telegram code")
            pending[uid] = {"client": client, "phone": body.phone,
                            "hash": sent.phone_code_hash, "expires": now + TTL,
                            "state": "code", "attempts": 0}
            return {"success": True, "step": "code", "expires_in": TTL}

    @router.post("/confirm")
    async def confirm(body: ConfirmRequest, uid: str = Depends(user_id)):
        async with lock:
            entry = await get_pending(uid, "code")
            entry["attempts"] += 1
            if entry["attempts"] > 5:
                pending.pop(uid, None)
                await close_entry(entry)
                raise HTTPException(429, "Too many attempts")
            try:
                await entry["client"].sign_in(phone=entry["phone"], code=body.code,
                                               phone_code_hash=entry["hash"])
            except SessionPasswordNeededError:
                entry["state"] = "password"
                return {"success": True, "step": "password"}
            except (PhoneCodeInvalidError, PhoneCodeExpiredError):
                raise HTTPException(400, "Invalid or expired code")
            except FloodWaitError:
                raise HTTPException(429, "Telegram rate limited the request")
            await finish(uid, entry)
            return {"success": True, "step": "connected"}

    @router.post("/password")
    async def password(body: PasswordRequest, uid: str = Depends(user_id)):
        async with lock:
            entry = await get_pending(uid, "password")
            entry["attempts"] += 1
            if entry["attempts"] > 5:
                pending.pop(uid, None)
                await close_entry(entry)
                raise HTTPException(429, "Too many attempts")
            try:
                await entry["client"].sign_in(password=body.password)
            except PasswordHashInvalidError:
                raise HTTPException(400, "Incorrect password")
            except FloodWaitError:
                raise HTTPException(429, "Telegram rate limited the request")
            await finish(uid, entry)
            return {"success": True, "step": "connected"}

    return router
