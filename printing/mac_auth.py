"""Supabase user login for Mac worker. Stores refresh token in a 0600 local file; never stores password."""
import os,json,time,getpass,pathlib,urllib.request,urllib.error
CONFIG=pathlib.Path.home()/".config"/"cuncun-print"/"session.json"
BASE="https://zigpqddlhvjbjrwhfhaa.supabase.co"
KEY="sb_publishable_U8VKihgNe0M7ff5KHB3Mvg_04ifZ7ni"
def exchange(grant,data):
    req=urllib.request.Request(BASE+"/auth/v1/token?grant_type="+grant,
        data=json.dumps(data).encode(),headers={"apikey":KEY,"Content-Type":"application/json"},method="POST")
    with urllib.request.urlopen(req,timeout=15) as resp:return json.load(resp)
def save(state):
    CONFIG.parent.mkdir(parents=True,exist_ok=True)
    temp=CONFIG.with_suffix(".tmp")
    fd=os.open(str(temp),os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,"w") as file:json.dump(state,file)
    os.replace(temp,CONFIG)
def session():
    try:
        if CONFIG.exists():return json.loads(CONFIG.read_text())
    except (ValueError,OSError):pass
    return {}
def token():
    state=session()
    if state.get("access_token") and state.get("expires_at",0)>time.time()+120:
        return state["access_token"]
    if state.get("refresh_token"):
        try:
            fresh=exchange("refresh_token",{"refresh_token":state["refresh_token"]})
            state.update({"access_token":fresh["access_token"],"refresh_token":fresh["refresh_token"],
                "expires_at":time.time()+fresh.get("expires_in",3600)})
            save(state)
            return state["access_token"]
        except urllib.error.HTTPError:
            print("Phiên Cuncun đã hết hạn, đăng nhập lại một lần.")
    email=input("Email Cuncun: ").strip()
    password=getpass.getpass("Mật khẩu Cuncun: ")
    fresh=exchange("password",{"email":email,"password":password})
    state.update({"access_token":fresh["access_token"],"refresh_token":fresh["refresh_token"],
        "expires_at":time.time()+fresh.get("expires_in",3600)})
    save(state)
    return state["access_token"]
