"""Telegram self-service API. Bound to loopback behind Cloudflare Access.
OTP endpoints are mounted only with explicit feature enablement and valid server secrets.
"""
import os
import re
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, Header, HTTPException

BASE = "https://zigpqddlhvjbjrwhfhaa.supabase.co"
SECRET = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
UUID_RE = re.compile(r"^[a-f0-9-]{36}$")
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

async def require_licensed_user(authorization: str = Header(default="")) -> str:
    if not SECRET:
        raise HTTPException(503, "Service not configured")
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(401, "Missing token")
    async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
        response = await client.get(
            BASE + "/auth/v1/user",
            headers={"apikey": SECRET, "Authorization": "Bearer " + token},
        )
        if response.status_code != 200:
            raise HTTPException(401, "Invalid login")
        uid = response.json().get("id", "")
        if not UUID_RE.fullmatch(uid):
            raise HTTPException(401, "Invalid identity")
        now = datetime.now(timezone.utc)
        licensed = False
        for table in ("email_licenses", "licenses"):
            result = await client.get(
                BASE + "/rest/v1/" + table,
                params={"select": "active,expires_at", "user_id": "eq." + uid, "limit": "5"},
                headers={"apikey": SECRET, "Authorization": "Bearer " + SECRET},
            )
            if result.status_code != 200:
                raise HTTPException(503, "License database unavailable")
            for entry in result.json():
                try:
                    expiry = datetime.fromisoformat(entry["expires_at"].replace("Z", "+00:00"))
                    if entry.get("active") is True and expiry > now:
                        licensed = True
                except (KeyError, ValueError, TypeError, AttributeError):
                    pass
        if not licensed:
            raise HTTPException(403, "Active license required")
        return uid

LOGIN_ENABLED = os.environ.get("TELEGRAM_LOGIN_ENABLED") == "1"
if LOGIN_ENABLED:
    # Fail startup rather than expose a partly configured OTP implementation.
    from telegram_login_flow import create_router
    app.include_router(create_router(require_licensed_user))

@app.get("/health")
async def health():
    return {
        "success": True,
        "service": "telegram-selfservice",
        "status": "otp-ready" if LOGIN_ENABLED else "identity-check",
        "telegram_login_enabled": LOGIN_ENABLED,
    }

@app.get("/capabilities")
async def capabilities(authorization: str = Header(default="")):
    try:
        await require_licensed_user(authorization)
        return {
            "success": True, "licensed": True,
            "self_service_enabled": LOGIN_ENABLED,
            "otp_flow_ready": LOGIN_ENABLED,
            "telegram_login_enabled": LOGIN_ENABLED,
        }
    except HTTPException as exc:
        if exc.status_code == 403:
            return {
                "success": True, "licensed": False,
                "self_service_enabled": False,
                "otp_flow_ready": False, "telegram_login_enabled": False,
            }
        raise
