#!/usr/bin/env python3
"""Cuncun queue worker for Mac Mini. Requires env SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
CUNCUN_ALLOWED_EMAILS. Run only on trusted Mac; never publish the key or open a port.
"""
import os, json, time, socket, urllib.request, urllib.parse, urllib.error, unicodedata
from datetime import datetime, timezone

BASE=os.environ["SUPABASE_URL"].rstrip("/")
KEY=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ALLOWED={e.strip().lower() for e in os.environ["CUNCUN_ALLOWED_EMAILS"].split(",") if e.strip()}
IP=os.getenv("CUNCUN_PRINTER_IP","192.168.1.159")
PORT=int(os.getenv("CUNCUN_PRINTER_PORT","9100"))
if not ALLOWED: raise SystemExit("CUNCUN_ALLOWED_EMAILS is required")
START=datetime.now(timezone.utc).isoformat()

def request(path,method="GET",data=None,extra=None):
    headers={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json"}
    if extra: headers.update(extra)
    req=urllib.request.Request(BASE+path,method=method,headers=headers,data=json.dumps(data).encode() if data is not None else None)
    with urllib.request.urlopen(req,timeout=12) as res:
        raw=res.read()
        return json.loads(raw) if raw else None

def normalized(s):
    s=unicodedata.normalize("NFKD",str(s))
    return "".join(ch for ch in s if not unicodedata.combining(ch)).encode("ascii","replace")

def qr_data(value):
    data=str(value).encode("utf-8")[:180]
    store_len=len(data)+3
    return (b"\x1d(k\x04\x001A2\x00"
            +b"\x1d(k\x03\x001C\x06"
            +b"\x1d(k\x03\x001E0"
            +b"\x1d(k"+bytes([store_len%256,store_len//256])+b"1P0"+data
            +b"\x1d(k\x03\x001Q0")

def receipt(job):
    text=job["print_text"][:16000]
    lines=[]
    for line in text.splitlines():
        if line.startswith("[[QR:") and line.endswith("]]"):
            lines.append(qr_data(line[5:-2]))
        else:
            lines.append(normalized(line)+"\n".encode())
    return b"\x1b\x40"+b"".join(lines)+b"\n\n\n\x1dV\x00"

def update(jobid,status,attempts=None,error=None):
    patch={"status":status,"error_message":error}
    if attempts is not None: patch["attempts"]=attempts
    if status=="printed": patch["printed_at"]=datetime.now(timezone.utc).isoformat()
    return request("/rest/v1/print_queue?id=eq."+str(jobid),"PATCH",patch,{"Prefer":"return=minimal"})

def allowed_user(user_id):
    u=request("/auth/v1/admin/users/"+urllib.parse.quote(str(user_id),safe=""))
    return str(u.get("email","")).lower() in ALLOWED

def run():
    print("CUNCUN worker started; only NEW jobs after",START,flush=True)
    while True:
        try:
            qs=urllib.parse.urlencode({"select":"id,user_id,print_text,status,attempts,created_at","status":"eq.pending","created_at":"gte."+START,"order":"id.asc","limit":"10"})
            jobs=request("/rest/v1/print_queue?"+qs)
            for job in jobs:
                if not allowed_user(job["user_id"]): continue
                jobid=job["id"]
                # Claim by conditional status, verify returned row to avoid duplicate worker processing.
                claim=request("/rest/v1/print_queue?id=eq."+str(jobid)+"&status=eq.pending","PATCH",{"status":"printing","attempts":int(job["attempts"])+1},{"Prefer":"return=representation"})
                if not claim: continue
                try:
                    with socket.create_connection((IP,PORT),timeout=8) as printer:
                        printer.sendall(receipt(job))
                    update(jobid,"printed",int(job["attempts"])+1)
                    print("PRINTED",jobid,flush=True)
                except Exception as exc:
                    update(jobid,"error",int(job["attempts"])+1,str(exc)[:300])
                    print("FAILED",jobid,str(exc),flush=True)
        except Exception as exc:
            print("WORKER ERROR",str(exc),flush=True)
        time.sleep(3)
if __name__=="__main__":run()
