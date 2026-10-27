#!/usr/bin/env python3
"""Cuncun Mac Mini print worker. pip3 install pillow qrcode
Uses a normal Cuncun login, never a service-role key.
Only processes new jobs after startup; claimed jobs never auto-retry.
"""
import os, json, time, socket, urllib.request, urllib.parse, getpass, pathlib, sys
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont
import qrcode

BASE="https://zigpqddlhvjbjrwhfhaa.supabase.co"
KEY="sb_publishable_U8VKihgNe0M7ff5KHB3Mvg_04ifZ7ni"
IP=os.getenv("CUNCUN_PRINTER_IP","192.168.1.159")
PORT=int(os.getenv("CUNCUN_PRINTER_PORT","9100"))
STATE=pathlib.Path.home()/".cuncun-print-session.json"
WIDTH=576

def api(path, method="GET", payload=None, token=None, representation=False):
    headers={"apikey":KEY,"Content-Type":"application/json"}
    if token: headers["Authorization"]="Bearer "+token
    if representation: headers["Prefer"]="return=representation"
    data=json.dumps(payload).encode() if payload is not None else None
    req=urllib.request.Request(BASE+path,headers=headers,data=data,method=method)
    with urllib.request.urlopen(req,timeout=15) as resp:
        raw=resp.read()
        return json.loads(raw) if raw else None

def save(s):
    temp=STATE.with_suffix(".tmp")
    temp.write_text(json.dumps(s))
    os.chmod(temp,0o600)
    temp.replace(STATE)

def session():
    s=json.loads(STATE.read_text()) if STATE.exists() else {}
    if s.get("refresh_token"):
        try: return refresh(s)
        except Exception: print("Phiên cũ hết hạn, đăng nhập lại.")
    email=input("Email Cuncun: ").strip()
    password=getpass.getpass("Mật khẩu Cuncun: ")
    t=api("/auth/v1/token?grant_type=password","POST",{"email":email,"password":password})
    s={"access_token":t["access_token"],"refresh_token":t["refresh_token"],
       "expires":time.time()+int(t.get("expires_in",3600))}
    save(s)
    return s

def refresh(s):
    t=api("/auth/v1/token?grant_type=refresh_token","POST",{"refresh_token":s["refresh_token"]})
    s.update(access_token=t["access_token"],refresh_token=t["refresh_token"],
             expires=time.time()+int(t.get("expires_in",3600)))
    save(s)
    return s

def token(s):
    if time.time()>s.get("expires",0)-120: refresh(s)
    return s["access_token"]

def patch(s,id,old,changes):
    qs=urllib.parse.urlencode({"id":"eq."+str(id),"status":"eq."+old})
    return api("/rest/v1/print_queue?"+qs,"PATCH",changes,token(s),True) or []

def font():
    for path in ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
                 "/System/Library/Fonts/Supplemental/Arial.ttf",
                 "/Library/Fonts/Arial.ttf"):
        if os.path.exists(path): return ImageFont.truetype(path,24)
    return ImageFont.load_default()

def raster(text):
    f=font()
    d=ImageDraw.Draw(Image.new("1",(WIDTH,1)))
    parts=[]
    for raw in text.replace("\r","").split("\n"):
        if raw.startswith("[[QR:") and raw.endswith("]]"):
            parts.append(("qr",raw[5:-2])); continue
        line=""
        for ch in raw:
            if line and d.textbbox((0,0),line+ch,font=f)[2]>WIDTH-32:
                parts.append(("text",line));line=ch
            else: line+=ch
        parts.append(("text",line))
    height=64+sum(228 if kind=="qr" else 36 for kind,_ in parts)
    img=Image.new("1",(WIDTH,height),1)
    draw=ImageDraw.Draw(img)
    y=12
    for kind,value in parts:
        if kind=="qr":
            qr=qrcode.QRCode(border=2,box_size=5)
            qr.add_data(value);qr.make(fit=True)
            pic=qr.make_image(fill_color="black",back_color="white").convert("1")
            pic.thumbnail((216,216))
            img.paste(pic,((WIDTH-pic.width)//2,y));y+=228
        else:
            draw.text((16,y),value,font=f,fill=0);y+=36
    yield b"\x1b\x40"
    for top in range(0,img.height,128):
        band=img.crop((0,top,WIDTH,min(top+128,img.height)))
        h=band.height
        yield b"\x1d\x76\x30\x00"+bytes((WIDTH//8,0,h%256,h//256))+bytes(b^255 for b in band.tobytes())
    yield b"\n\n\x1d\x56\x00"

def run():
    s=session()
    start=int(os.getenv("CUNCUN_START_AFTER_ID","235"))
    print("Worker đã kết nối. Chỉ in ID >",start,"Máy:",IP,PORT,flush=True)
    while True:
        try:
            params=urllib.parse.urlencode({"select":"id,print_text,attempts",
                "status":"eq.pending","id":"gt."+str(start),"order":"id.asc","limit":"5"})
            jobs=api("/rest/v1/print_queue?"+params,token=token(s)) or []
            for job in jobs:
                id=job["id"]
                if not patch(s,id,"pending",{"status":"printing","attempts":int(job["attempts"] or 0)+1}):continue
                try:
                    with socket.create_connection((IP,PORT),timeout=8) as printer:
                        printer.settimeout(15)
                        for chunk in raster(job["print_text"]):printer.sendall(chunk)
                    patch(s,id,"printing",{"status":"printed","printed_at":datetime.now(timezone.utc).isoformat()})
                    print("ĐÃ GỬI MÁY IN:",id,flush=True)
                except Exception as e:
                    patch(s,id,"printing",{"status":"failed","error_message":str(e)[:300]})
                    print("LỖI:",id,e,file=sys.stderr,flush=True)
            time.sleep(3)
        except KeyboardInterrupt: break
        except Exception as e:
            print("Đang kết nối lại:",e,file=sys.stderr,flush=True);time.sleep(8)

if __name__=="__main__":run()
