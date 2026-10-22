"""Telegram self-service phase 1: verified identity and license only.
No Telegram OTP/session handling here. Bind exclusively to loopback.
"""
import os
import re
from datetime import datetime, timezone
import httpx
from fastapi import FastAPI, Header, HTTPException

BASE = "https://zigpqddlhvjbjrwhfhaa.supabase.co"
SECRET = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
UUID_RE = re.compile(r"^[a-f0-9-]{36}$")

@app.get("/health")
async def health():
    return {"success": True, "service": "telegram-selfservice",
            "status": "identity-check", "telegram_login_enabled": False}

@app.get("/capabilities")
async def capabilities(authorization: str = Header(default="")):
    if not SECRET or not authorization.startswith("Bearer "):
        raise HTTPException(503 if not SECRET else 401, "Not configured or unauthorized")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(401, "Missing token")
    async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
        response = await client.get(BASE + "/auth/v1/user",
            headers={"apikey": SECRET, "Authorization": "Bearer " + token})
        if response.status_code != 200:
            raise HTTPException(401, "Invalid login")
        user = response.json()
        uid = user.get("id", "")
        if not UUID_RE.fullmatch(uid):
            raise HTTPException(401, "Invalid identity")
        now = datetime.now(timezone.utc)
        licensed = False
        for table in ("email_licenses", "licenses"):
            result = await client.get(BASE + "/rest/v1/" + table,
                params={"select": "active,expires_at", "user_id": "eq." + uid, "limit": "1"},
                headers={"apikey": SECRET, "Authorization": "Bearer " + SECRET})
            if result.status_code != 200:
                raise HTTPException(503, "License database unavailable")
            for entry in result.json():
                try:
                    expiry = datetime.fromisoformat(entry["expires_at"].replace("Z", "+00:00"))
                    if entry.get("active") is True and expiry > now:
                        licensed = True
                except (KeyError, ValueError, TypeError):
                    pass
        return {"success": True, "licensed": licensed,
                "self_service_enabled": False, "otp_flow_ready": False,
                "telegram_login_enabled": False}
