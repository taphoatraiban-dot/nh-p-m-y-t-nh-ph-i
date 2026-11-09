import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-push-key","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const out=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers});
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const checked=(r:any)=>{if(r.error)throw r.error;return r.data;};
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,"0")).join("");
const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function endpointOK(v:unknown){
 if(typeof v!=="string"||v.length>4096)return false;
 try{const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password&&(!u.port||u.port==="443")&&(u.hostname==="fcm.googleapis.com"||u.hostname==="updates.push.services.mozilla.com"||u.hostname.endsWith(".push.services.mozilla.com")||u.hostname==="web.push.apple.com"||u.hostname.endsWith(".push.apple.com")||u.hostname.endsWith(".notify.windows.com"));}catch{return false;}
}
function keyOK(v:unknown,n:number){try{if(typeof v!=="string"||v.length>200||!/^[a-zA-Z0-9_-]+={0,2}$/.test(v))return false;const raw=atob(v.replace(/-/g,"+").replace(/_/g,"/"));return raw.length===n&&(n!==65||raw.charCodeAt(0)===4);}catch{return false;}}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return out({error:"Method not allowed"},405);
 try{
  const action=new URL(req.url).searchParams.get("action")||"status",b=await req.json();
  const config=checked(await db.from("telegram_push_config").select("public_key,dispatcher_hash").eq("singleton",true).maybeSingle());
  if(!config)return out({error:"Thông báo nền chưa sẵn sàng"},503);
  if(action==="public-key")return out({success:true,public_key:config.public_key});
  if(action==="claim"||action==="ack"){
   const key=req.headers.get("x-push-key")||"";
   if(key.length<40||await hash(key)!==config.dispatcher_hash)return out({error:"Unauthorized"},401);
   if(action==="claim")return out({success:true,jobs:checked(await db.rpc("telegram_push_claim"))});
   if(!uuid(b.id)||!["sent","expired","retry"].includes(b.state))return out({error:"Invalid receipt"},400);
   const job=checked(await db.from("telegram_push_deliveries").select("subscription_id,state,attempts").eq("id",b.id).maybeSingle());
   if(!job)return out({error:"Unknown receipt"},404);
   if(job.state!=="sending")return out({success:true});
   if(b.state==="expired")checked(await db.from("telegram_push_subscriptions").update({enabled:false}).eq("id",job.subscription_id));
   const state=b.state==="retry"?(job.attempts>=5?"expired":"queued"):b.state;
   checked(await db.from("telegram_push_deliveries").update({state,next_at:new Date(Date.now()+Math.min(300,15*2**job.attempts)*1000).toISOString()}).eq("id",b.id).eq("state","sending"));
   return out({success:true});
  }
  const token=(req.headers.get("authorization")||"").replace(/^Bearer /i,"");
  if(!token)return out({error:"Cần đăng nhập phần mềm"},401);
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user)return out({error:"Cần đăng nhập phần mềm"},401);
  if(!endpointOK(b.endpoint))return out({error:"Địa chỉ thông báo không hợp lệ"},400);
  const current=checked(await db.from("telegram_push_subscriptions").select("id,user_id,enabled").eq("endpoint",b.endpoint).maybeSingle());
  if(action==="status")return out({success:true,enabled:current?.user_id===user.id&&current.enabled===true,public_key:config.public_key});
  if(action==="disable"){
   checked(await db.from("telegram_push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("user_id",user.id).eq("endpoint",b.endpoint));
   return out({success:true,enabled:false});
  }
  if(action!=="register")return out({error:"Bad action"},400);
  const allowed=checked(await db.from("telegram_chat_access").select("enabled").eq("user_id",user.id).maybeSingle());
  if(!allowed?.enabled)return out({error:"Tài khoản chưa kết nối Telegram Chat"},403);
  if(!keyOK(b.keys?.p256dh,65)||!keyOK(b.keys?.auth,16))return out({error:"Khóa thiết bị không hợp lệ"},400);
  if(current&&current.user_id!==user.id)return out({error:"Thông báo đang gắn với tài khoản khác trên thiết bị này",code:"OTHER_ACCOUNT"},409);
  if(!current?.enabled){
   const active=checked(await db.from("telegram_push_subscriptions").select("id").eq("user_id",user.id).eq("enabled",true).limit(10));
   if((active||[]).length>=10)return out({error:"Đã bật trên 10 thiết bị. Hãy tắt thông báo trên thiết bị không dùng trước."},429);
  }
  const now=new Date().toISOString();
  const values={user_id:user.id,endpoint:b.endpoint,p256dh:b.keys.p256dh,auth_key:b.keys.auth,enabled:true,updated_at:now,...(!current?.enabled?{enabled_since:now}:{})};
  const result=current?await db.from("telegram_push_subscriptions").update(values).eq("user_id",user.id).eq("id",current.id):await db.from("telegram_push_subscriptions").insert(values);
  checked(result);return out({success:true,enabled:true});
 }catch{return out({error:"Không thể xử lý thông báo nền"},500);}
});
