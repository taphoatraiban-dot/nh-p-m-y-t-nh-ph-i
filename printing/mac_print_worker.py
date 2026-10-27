#!/usr/bin/env python3
"""Cuncun Mac worker: set CUNCUN_ACCESS_TOKEN to the logged-in user's Supabase JWT.
The worker never uses a service-role key. Old pending jobs are intentionally ignored.
"""
import os,sys,json,time,socket,datetime,urllib.request,urllib.parse
import mac_auth
from PIL import Image,ImageDraw,ImageFont
import qrcode
BASE="https://zigpqddlhvjbjrwhfhaa.supabase.co/rest/v1/print_queue"
KEY="sb_publishable_U8VKihgNe0M7ff5KHB3Mvg_04ifZ7ni"
TOKEN=os.environ.get("CUNCUN_ACCESS_TOKEN")
ACTIVATED=os.environ.get("CUNCUN_PRINT_ACTIVATED_AT")
IP=os.environ.get("CUNCUN_PRINTER_IP","192.168.1.159")
if not ACTIVATED:
    state=mac_auth.session()
    ACTIVATED=state.get("activation") or datetime.datetime.now(datetime.timezone.utc).isoformat()
    state["activation"]=ACTIVATED
    mac_auth.save(state)
HEAD={"apikey":KEY,"Authorization":"Bearer "+(TOKEN or ""),"Content-Type":"application/json","Prefer":"return=representation"}
def api(method,params,body=None):
    HEAD["Authorization"]="Bearer "+(TOKEN or mac_auth.token())
    url=BASE+"?"+urllib.parse.urlencode(params)
    req=urllib.request.Request(url,headers=HEAD,method=method,data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req,timeout=15) as resp:
        return json.loads(resp.read() or b"null")
def raster(text):
    width=576
    font_path=next((p for p in ["/System/Library/Fonts/Supplemental/Arial Unicode.ttf","/System/Library/Fonts/Supplemental/Arial.ttf"] if os.path.exists(p)),None)
    if not font_path: raise RuntimeError("Missing Unicode font")
    font=ImageFont.truetype(font_path,23)
    rows=[]
    measure=ImageDraw.Draw(Image.new("1",(1,1)))
    for line in text.splitlines():
        if line.startswith("[[QR:") and line.endswith("]]"): rows.append(("qr",line[5:-2]));continue
        chunk=""
        for ch in line:
            if chunk and measure.textlength(chunk+ch,font=font)>width-20:
                rows.append(("text",chunk));chunk=ch
            else:chunk+=ch
        rows.append(("text",chunk))
    image=Image.new("1",(width,sum(250 if kind=="qr" else 32 for kind,_ in rows)+30),1)
    draw=ImageDraw.Draw(image);y=10
    for kind,value in rows:
        if kind=="qr":
            qr=qrcode.make(value).convert("1").resize((230,230))
            image.paste(qr,((width-230)//2,y));y+=250
        else:
            draw.text((10,y),value,font=font,fill=0);y+=32
    out=bytearray(b"\x1b\x40")
    for top in range(0,image.height,128):
        part=image.crop((0,top,width,min(top+128,image.height)))
        w,h=part.size; n=(w+7)//8;data=bytearray(n*h)
        for yy in range(h):
            for xx in range(w):
                if part.getpixel((xx,yy))==0:data[yy*n+xx//8]|=128>>(xx%8)
        out+=b"\x1d\x76\x30\x00"+bytes((n%256,n//256,h%256,h//256))+data
    return bytes(out)+b"\n\n\n\x1d\x56\x00"
while True:
    try:
        if not TOKEN: HEAD["Authorization"]="Bearer "+mac_auth.token()
        jobs=api("GET",{"select":"id,print_text","status":"eq.pending","created_at":"gte."+ACTIVATED,"order":"id.asc","limit":"10"})
        for job in jobs:
            filter={"id":"eq."+str(job["id"]),"status":"eq.pending"}
            if not api("PATCH",filter,{"status":"printing","attempts":1}):continue
            try:
                with socket.create_connection((IP,9100),timeout=8) as sock:sock.sendall(raster(job["print_text"]))
                api("PATCH",{"id":"eq."+str(job["id"]),"status":"eq.printing"},{"status":"printed","printed_at":datetime.datetime.now(datetime.timezone.utc).isoformat()})
                print("SENT",job["id"])
            except Exception as exc:
                api("PATCH",{"id":"eq."+str(job["id"]),"status":"eq.printing"},{"status":"error","error_message":str(exc)[:250]})
                print("ERROR",job["id"],exc)
    except Exception as exc:print("POLL ERROR",exc)
    time.sleep(3)
