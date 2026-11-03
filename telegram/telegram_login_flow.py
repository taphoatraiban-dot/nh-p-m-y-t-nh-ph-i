"""Isolated Telegram OTP flow; NOT mounted in the running API until VPS rollout.

Requires telethon==1.45.0, cryptography, TELEGRAM_API_ID, TELEGRAM_API_HASH,
TELEGRAM_SESSION_KEY (Fernet), TELEGRAM_SESSION_DIR (chmod 0700).
Mount with create_router(require_licensed_user) AFTER checking identity/license.
Single uvicorn worker; use durable, shared expiring state before scaling.
"""
import asyncio
import json
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

class GroupSelectionRequest(BaseModel):
    chat_ids: list[str] = Field(default_factory=list, max_length=200)

class PasswordRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)

def create_router(require_licensed_user):
    router = APIRouter(prefix="/telegram-login", tags=["telegram-login"])
    api_id = int(os.environ["TELEGRAM_API_ID"])
    api_hash = os.environ["TELEGRAM_API_HASH"]
    cipher = Fernet(os.environ["TELEGRAM_SESSION_KEY"].encode("ascii"))
    directory = Path(os.environ.get("TELEGRAM_SESSION_DIR", "/var/lib/ongthantai-telegram-sessions"))
    if directory.is_symlink():
        raise RuntimeError("Session directory must not be a symlink")
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if directory.is_symlink() or directory.stat().st_mode & 0o077:
        raise RuntimeError("Session directory must be private and not a symlink")

    def path_for(uid):
        if not UUID.fullmatch(uid):
            raise HTTPException(401, "Invalid user")
        return directory / (uid + ".session.enc")

    def require_private_session(path):
        if path.is_symlink() or not path.is_file():
            raise HTTPException(503, "Saved Telegram session is unsafe or unavailable")
        if path.stat().st_mode & 0o077:
            raise HTTPException(503, "Saved Telegram session permissions are unsafe")

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
        try:
            value = entry["client"].session.save()
            encrypted = cipher.encrypt(value.encode("utf-8"))
            target = path_for(uid)
            temporary = target.with_name(target.name + "." + secrets.token_hex(8) + ".tmp")
            if target.exists():
                raise HTTPException(409, "A session is already saved for this account")
            fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            try:
                with os.fdopen(fd, "wb") as output:
                    output.write(encrypted)
                os.link(temporary, target)
            finally:
                temporary.unlink(missing_ok=True)
        finally:
            pending.pop(uid, None)
            await close_entry(entry)

    async def get_pending(uid, expected):
        entry = pending.get(uid)
        if not entry or entry["expires"] < time.monotonic() or entry["state"] != expected:
            pending.pop(uid, None)
            await close_entry(entry)
            raise HTTPException(409, "Login session expired; start again")
        return entry

    @router.post("/logout")
    async def logout(uid: str = Depends(user_id)):
        """Queue disconnect for the authenticated customer only."""
        marker = directory / (uid + ".revoked")
        if marker.is_symlink():
            raise HTTPException(503, "Unsafe disconnect state")
        async with lock:
            old = pending.pop(uid, None)
            await close_entry(old)
            if not marker.exists():
                fd = os.open(marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                             getattr(os, "O_NOFOLLOW", 0), 0o600)
                with os.fdopen(fd, "w", encoding="utf-8") as output:
                    output.write(uid)
        return {"success": True, "disconnect_pending": True}

    @router.post("/start")
    async def start(body: StartRequest, uid: str = Depends(user_id)):
        if not PHONE.fullmatch(body.phone):
            raise HTTPException(400, "Use international format, e.g. +849xxxxxxxx")
        if (directory / (uid + ".revoked")).exists():
            raise HTTPException(409, "Disconnect still processing")
        if path_for(uid).exists():
            raise HTTPException(409, "A session is already saved for this account")
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
            except PhoneCodeExpiredError:
                pending.pop(uid, None)
                await close_entry(entry)
                raise HTTPException(409, "Telegram code expired; request a new code")
            except PhoneCodeInvalidError:
                raise HTTPException(400, "Invalid Telegram code")
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

    @router.get("/groups")
    async def list_available_groups(uid: str = Depends(user_id)):
        """List groups from the customer's own saved Telegram session only."""
        saved = path_for(uid)
        if not saved.is_file():
            raise HTTPException(409, "Connect Telegram first")
        require_private_session(saved)
        try:
            session_value = cipher.decrypt(saved.read_bytes()).decode("utf-8")
        except Exception:
            raise HTTPException(503, "Unable to read saved Telegram session")
        client = TelegramClient(StringSession(session_value), api_id, api_hash)
        try:
            await client.connect()
            if not await client.is_user_authorized():
                raise HTTPException(401, "Telegram session is no longer authorized")
            groups = []
            async for dialog in client.iter_dialogs():
                if dialog.is_group:
                    groups.append({"chat_id": str(dialog.id), "name": dialog.name})
                if len(groups) >= 200:
                    break
            return {"success": True, "groups": groups}
        finally:
            await client.disconnect()

    @router.post("/groups/select")
    async def select_groups(body: GroupSelectionRequest, uid: str = Depends(user_id)):
        """Save explicit group consent; never activate or change a running worker."""
        selected = body.chat_ids
        if len(selected) != len(set(selected)):
            raise HTTPException(400, "Duplicate group IDs")
        if any(not re.fullmatch(r"-?[0-9]{1,19}", value) for value in selected):
            raise HTTPException(400, "Invalid group ID")
        saved = path_for(uid)
        if not saved.is_file():
            raise HTTPException(409, "Connect Telegram first")
        require_private_session(saved)
        try:
            session_value = cipher.decrypt(saved.read_bytes()).decode("utf-8")
        except Exception:
            raise HTTPException(503, "Unable to read saved Telegram session")
        client = TelegramClient(StringSession(session_value), api_id, api_hash)
        try:
            await client.connect()
            if not await client.is_user_authorized():
                raise HTTPException(401, "Telegram session expired")
            allowed = set()
            async for dialog in client.iter_dialogs():
                if dialog.is_group:
                    allowed.add(str(dialog.id))
            if not set(selected).issubset(allowed):
                raise HTTPException(403, "Selected groups must belong to this Telegram account")
        finally:
            await client.disconnect()
        target = directory / (uid + ".groups.json")
        if target.is_symlink():
            raise HTTPException(503, "Saved group selection is unsafe")
        temporary = target.with_name(target.name + "." + secrets.token_hex(8) + ".tmp")
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as output:
                json.dump({"user_id": uid, "allowed_chat_ids": [int(v) for v in selected]}, output)
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
        return {"success": True, "selected_count": len(selected), "worker_started": False}

    @router.get("/groups/selection")
    async def get_group_selection(uid: str = Depends(user_id)):
        """Read only this customer's consented group IDs; no worker side effects."""
        target = directory / (uid + ".groups.json")
        if target.is_symlink():
            raise HTTPException(503, "Saved group selection is unsafe")
        if not target.is_file():
            return {"success": True, "chat_ids": [], "configured": False}
        if target.stat().st_mode & 0o077:
            raise HTTPException(503, "Saved group selection permissions are unsafe")
        try:
            data = json.loads(target.read_text(encoding="utf-8"))
            if data.get("user_id") != uid:
                raise ValueError("Wrong owner")
            values = data["allowed_chat_ids"]
            if (not isinstance(values, list) or len(values) > 200 or
                    any(type(v) is not int or abs(v) > 9999999999999999999 for v in values)):
                raise ValueError("Invalid selection")
        except (OSError, ValueError, KeyError, TypeError):
            raise HTTPException(503, "Saved group selection is invalid")
        return {"success": True, "chat_ids": [str(v) for v in values], "configured": True}

    return router
