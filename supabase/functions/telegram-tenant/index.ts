import {createClient} from "npm:@supabase/supabase-js@2";
const base=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(base,service,{auth:{persistSession:false}});
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-telegram-bot-api-secret-token","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const reply=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers});
const bytes=(x:Uint8Array)=>Array.from(x).map(v=>v.toString(16).padStart(2,"0")).join("");
const hash=async(s:string)=>bytes(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))));
async function key(){const source=await crypto.subtle.importKey("raw",new TextEncoder().encode(service),"HKDF",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",salt:new TextEncoder().encode("ott-tenant-v1"),info:new TextEncoder().encode("telegram-bot-token-encryption")},source,{name:"AES-GCM",length:256},false,["encrypt","decrypt"])}
async function encrypt(s:string){const iv=crypto.getRandomValues(new Uint8Array(12)),data=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(),new TextEncoder().encode(s)));return bytes(iv)+":"+bytes(data)}
async function decrypt(s:string){const [a,b]=s.split(":");const decode=(v:string)=>new Uint8Array(v.match(/.{2}/g)!.map(x=>parseInt(x,16)));return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(a)},await key(),decode(b)))}
async function telegram(token:string,method:string,body?:unknown){const r=await fetch("https://api.telegram.org/bot"+token+"/"+method,{method:body?"POST":"GET",...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});return await r.json()}
async function telegramProAllowed(uid:string){
 const {data,error}=await db.rpc("telegram_account_entitled",{p_user_id:uid});
 return !error&&data===true;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 const url=new URL(req.url),segments=url.pathname.split("/").filter(Boolean),webhook=segments[segments.length-2]==="hook",userId=segments[segments.length-1];
 if(webhook){
  if(req.method!=="POST"||!/^[-0-9a-f]{36}$/.test(userId))return reply({error:"Not found"},404);
  const {data:bot}=await db.from("telegram_tenant_bots").select("user_id,webhook_secret_hash,enabled").eq("user_id",userId).maybeSingle();
  if(!bot?.enabled)return reply({error:"Not found"},404);
  const secret=req.headers.get("x-telegram-bot-api-secret-token")||"";
  if(!secret||await hash(secret)!==bot.webhook_secret_hash)return reply({error:"Unauthorized"},401);
  let update:any;try{update=await req.json()}catch{return reply({error:"Bad JSON"},400)}
  const chat=update.my_chat_member?.chat||update.message?.chat;
  if(!chat||!["group","supergroup"].includes(chat.type))return reply({ok:true});
  const {data:known}=await db.from("telegram_tenant_groups").select("enabled").eq("user_id",userId).eq("chat_id",chat.id).maybeSingle();
  if(!known){await db.from("telegram_tenant_groups").upsert({user_id:userId,chat_id:chat.id,group_name:String(chat.title||"Nhóm Telegram").slice(0,150),enabled:false},{onConflict:"user_id,chat_id"});return reply({ok:true})}
  if(update.message?.text&&known.enabled){
   const m=update.message;
   await db.from("telegram_tenant_messages").upsert({user_id:userId,chat_id:chat.id,message_id:m.message_id,message_text:m.text,message_date:new Date(m.date*1000).toISOString()},{onConflict:"user_id,chat_id,message_id",ignoreDuplicates:true});
  }
  return reply({ok:true});
 }
 const bearer=req.headers.get("Authorization")||"";
 if(!bearer.startsWith("Bearer "))return reply({error:"Unauthorized"},401);
 const {data:{user},error:authError}=await db.auth.getUser(bearer.slice(7));if(authError||!user||user.is_anonymous)return reply({error:"Unauthorized"},401);
 if(!await telegramProAllowed(user.id))return reply({error:"Telegram chỉ dành cho PRO / ADMIN",code:"PRO_REQUIRED"},403);
 if(req.method==="GET"){
  const {data:bot}=await db.from("telegram_tenant_bots").select("bot_id,bot_username,enabled").eq("user_id",user.id).maybeSingle();
  const {data:groups}=await db.from("telegram_tenant_groups").select("chat_id,group_name,enabled").eq("user_id",user.id).order("created_at",{ascending:false});
  const ids=(groups||[]).filter(g=>g.enabled).map(g=>g.chat_id);
  let messages:any[]=[];
  if(ids.length){const since=new Date(Date.now()-48*3600000).toISOString();const {data}=await db.from("telegram_tenant_messages").select("id,chat_id,message_text,message_date").eq("user_id",user.id).in("chat_id",ids).gte("message_date",since).order("message_date",{ascending:false}).limit(300);messages=data||[]}
  return reply({success:true,bot,groups:groups||[],messages});
 }
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 let body:any;try{body=await req.json()}catch{return reply({error:"Invalid JSON"},400)}
 if(body.action==="connect"){
  const token=String(body.token||"").trim();
  if(!/^\d{5,15}:[A-Za-z0-9_-]{25,}$/.test(token))return reply({error:"Invalid bot token format"},400);
  const result=await telegram(token,"getMe");if(!result.ok||!result.result?.is_bot)return reply({error:"Bot token invalid"},400);
  const botId=result.result.id,username=result.result.username;
  const {data:owner}=await db.from("telegram_tenant_bots").select("user_id").eq("bot_id",botId).maybeSingle();
  if(owner&&owner.user_id!==user.id)return reply({error:"Bot already connected to another account"},409);
  const {data:previous}=await db.from("telegram_tenant_bots").select("bot_id").eq("user_id",user.id).maybeSingle();
  if(previous&&previous.bot_id!==botId)return reply({error:"Disconnect the existing bot before changing bots"},409);
  const secret=bytes(crypto.getRandomValues(new Uint8Array(32)));
  const ciphertext=await encrypt(token);
  const {error:saveError}=await db.from("telegram_tenant_bots").upsert({user_id:user.id,bot_id:botId,bot_username:username,token_ciphertext:ciphertext,webhook_secret_hash:await hash(secret),enabled:true,updated_at:new Date().toISOString()},{onConflict:"user_id"});
  if(saveError)return reply({error:"Cannot save bot"},500);
  const webhookUrl=base+"/functions/v1/telegram-tenant/hook/"+user.id;
  const result2=await telegram(token,"setWebhook",{url:webhookUrl,secret_token:secret,allowed_updates:["message","my_chat_member"],drop_pending_updates:false});
  if(!result2.ok){await db.from("telegram_tenant_bots").update({enabled:false}).eq("user_id",user.id);return reply({error:"Telegram webhook setup failed. Connection disabled."},502)}
  return reply({success:true,bot_username:username});
 }
 if(body.action==="enable_group"){
  if(!Number.isSafeInteger(body.chat_id)||typeof body.enabled!=="boolean")return reply({error:"Invalid group"},400);
  const {data,error}=await db.from("telegram_tenant_groups").update({enabled:body.enabled}).eq("user_id",user.id).eq("chat_id",body.chat_id).select("chat_id,enabled").maybeSingle();
  return error?reply({error:"Update failed"},500):data?reply({success:true,group:data}):reply({error:"Group not found"},404);
 }
 if(body.action==="disconnect"){
  const {data:bot}=await db.from("telegram_tenant_bots").select("token_ciphertext").eq("user_id",user.id).maybeSingle();
  if(!bot)return reply({success:true});
  try{const token=await decrypt(bot.token_ciphertext);const current=await telegram(token,"getWebhookInfo");if(current.ok&&current.result?.url===base+"/functions/v1/telegram-tenant/hook/"+user.id)await telegram(token,"deleteWebhook",{drop_pending_updates:false})}catch{return reply({error:"Could not safely disconnect Telegram webhook"},502)}
  await db.from("telegram_tenant_bots").delete().eq("user_id",user.id);
  return reply({success:true});
 }
 return reply({error:"Unknown action"},400);
});