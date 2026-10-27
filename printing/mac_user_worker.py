#!/usr/bin/env python3
"""Cuncun secure Mac queue worker. pip3 install pillow qrcode
Sign in with your own Cuncun account; no service_role key is used.
Only jobs newer than CUNCUN_START_AFTER_ID (default 235) are processed.
"""
import getpass,json,os,pathlib,socket,time,urllib.parse,urllib.request
from datetime import datetime,timezone
from PIL import Image,ImageDraw,ImageFont
import qrcode
BASE="https://zigpqddlhvjbjrwhfhaa.supabase.co"
KEY="sb_publishable_U8VKihgNe0M7ff5KHB3Mvg_04ifZ7ni"
IP=os.getenv("CUNCUN_PRINTER_IP","192.168.1.159")
PORT=int(os.getenv("CUNCUN_PRINTER_PORT","9100"))
MIN_ID=int(os.getenv("CUNCUN_START_AFTER_ID","235"))
SESSION=pathlib.Path.home()/".cuncun-print-session.json"

def api(path,method="GET",token=None,data=None,params=None,return_rows=False):
    url=BASE+path+("?" + urllib.parse.urlencode(params) if params else "")
    headers={"apikey":KEY,"Content-Type":"application/json"}
    if token: headers["Authorization"]="Bearer "+token
    if return_rows: headers["Prefer"]="return=representation"
    req=urllib.request.Request(url,method=method,headers=headers,
      data=json.dumps(data).encode("utf-8") if data is not None else None)
    with urllib.request.urlopen(req,timeout=15) as resp:
        raw=resp.read()
        return json.loads(raw) if raw else None

def save(session):
    tmp=SESSION.with_suffix(".tmp")
    tmp.write_text(json.dumps(session))
    os.chmod(tmp,0o600)
    tmp.replace(SESSION)

def refresh(session):
    t=api("/auth/v1/token","POST",data={"refresh_token":session["refresh_token"]},
          params={"grant_type":"refresh_token"})
    session.update(access_token=t["access_token"],refresh_token=t["refresh_token"],
                   expires_at=time.time()+t.get("expires_in",3600))
    save(session)
    return session["access_token"]

def login():
    if SESSION.exists():
        try:
            s=json.loads(SESSION.read_text())
            refresh(s)
            return s
        except Exception: print("Phiên đăng nhập cũ hết hạn.")
    email=input("Email tài khoản Cuncun: ").strip()
    password=getpass.getpass("Mật khẩu (không hiển thị): ")
    t=api("/auth/v1/token","POST",data={"email":email,"password":password},
          params={"grant_type":"password"})
    s={"access_token":t["access_token"],"refresh_token":t["refresh_token"],
       "expires_at":time.time()+t.get("expires_in",3600)}
    save(s)
    return s

def token(s):
    return refresh(s) if time.time()>s["expires_at"]-120 else s["access_token"]

def render(text):
    width=576
    fonts=["/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
           "/System/Library/Fonts/Supplemental/Arial.ttf",
           "/Library/Fonts/Arial.ttf"]
    f=next((ImageFont.truetype(p,23) for p in fonts if os.path.exists(p)),ImageFont.load_default())
    probe=ImageDraw.Draw(Image.new("1",(width,1)))
    parts=[]
    for line in text.replace("\r","").split("\n"):
        if line.startswith("[[QR:") and line.endswith("]]"):
            parts.append(("qr",line[5:-2]));continue
        if not line: parts.append(("text",""));continue
        cur=""
        for c in line:
            if cur and probe.textbbox((0,0),cur+c,font=f)[2]>width-32:
                parts.append(("text",cur));cur=c
            else:cur+=c
        parts.append(("text",cur))
    height=72+sum(240 if kind=="qr" else 34 for kind,_ in parts)
    img=Image.new("1",(width,height),1)
    d=ImageDraw.Draw(img);y=16
    for kind,value in parts:
        if kind=="qr":
            qr=qrcode.make(value).convert("1")
            qr.thumbnail((220,220))
            img.paste(qr,((width-qr.width)//2,y));y+=240
        else:
            d.text((16,y),value,font=f,fill=0);y+=34
    return img.crop((0,0,width,y+56))

def print_receipt(text):
    img=render(text)
    with socket.create_connection((IP,PORT),timeout=8) as sock:
        sock.settimeout(12)
        sock.sendall(b"\x1b\x40")
        for y in range(0,img.height,128):
            band=img.crop((0,y,img.width,min(y+128,img.height)))
            w=(band.width+7)//8;h=band.height
            sock.sendall(b"\x1d\x76\x30\x00"+bytes([w%256,w//256,h%256,h//256])
                         +bytes(x^255 for x in band.tobytes()))
        sock.sendall(b"\n\n\x1d\x56\x00")

def patch(s,job,old,changes):
    return api("/rest/v1/print_queue","PATCH",token(s),changes,
      {"id":"eq."+str(job),"status":"eq."+old},return_rows=True) or []

def main():
    s=login()
    print("Mac worker: %s:%s; chỉ nhận phiếu ID > %s"%(IP,PORT,MIN_ID),flush=True)
    while True:
        try:
            jobs=api("/rest/v1/print_queue",token=token(s),params={
                "select":"id,print_text,attempts","status":"eq.pending",
                "id":"gt."+str(MIN_ID),"order":"id.asc","limit":"5"}) or []
            for job in jobs:
                jid=job["id"]
                if len(patch(s,jid,"pending",{"status":"printing",
                       "attempts":int(job.get("attempts") or 0)+1}))!=1:continue
                try:
                    print_receipt(job["print_text"])
                    patch(s,jid,"printing",{"status":"printed",
                          "printed_at":datetime.now(timezone.utc).isoformat()})
                    print("ĐÃ GỬI PHIẾU",jid,flush=True)
                except Exception as exc:
                    patch(s,jid,"printing",{"status":"failed","error_message":str(exc)[:300]})
                    print("IN LỖI",jid,exc,flush=True)
            time.sleep(3)
        except KeyboardInterrupt:break
        except Exception as exc:
            print("Kết nối lỗi, thử lại:",exc,flush=True);time.sleep(8)
if __name__=="__main__":main()
