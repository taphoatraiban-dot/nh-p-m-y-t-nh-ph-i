import {createClient} from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json"};
const respond=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:cors});
const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(url,key,{auth:{persistSession:false}});
const cryptoKey=await crypto.subtle.importKey("raw",await crypto.subtle.digest("SHA-256",new TextEncoder().encode(key+"telegram-customer-bot-v1")),{name:"AES-GCM"},false,["encrypt","decrypt"]);
const enc=async(t:string)=>{const iv=crypto.getRandomValues(new Uint8Array(12));const v=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},cryptoKey,new TextEncoder().encode(t)));return btoa(String.fromCharCode(...iv,...v))};
const dec=async(t:string)=>{const b=Uint8Array.from(atob(t),x=>x.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:b.slice(0,12)},cryptoKey,b.slice(12)))};
async function telegramProAllowed(uid:string){
 const {data,error}=await db.rpc("telegram_account_entitled",{p_user_id:uid});
 return !error&&data===true;
}
Deno.serve(async(req)=>{
if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
const u=new URL(req.url),botId=u.searchParams.get("bot");
if(botId&&req.method==="POST"){
 const {data:bot}=await db.from("telegram_customer_bots").select("*").eq("id",botId).maybeSingle();
 if(!bot||req.headers.get("X-Telegram-Bot-Api-Secret-Token")!==bot.webhook_secret)return respond({error:"Unauthorized"},401);
 let update:any;try{update=await req.json()}catch{return respond({error:"Bad JSON"},400)}
 const m=update.message;if(!m||m.chat?.type!=="private"||!m.from?.id)return respond({ok:true});
 const content=String(m.text||m.caption||"").trim();if(!content||content.startsWith("/"))return respond({ok:true});
 const origin=m.forward_origin;
 const {error}=await db.from("telegram_forwarded_inbox").upsert({owner_user_id:bot.user_id,owner_telegram_id:Number(m.from.id),bot_chat_id:Number(m.chat.id),bot_message_id:Number(m.message_id),origin_chat_id:origin?.chat?.id||null,origin_name:origin?.chat?.title||origin?.sender_user_name||"Chuyển tiếp",sender_name:m.from.first_name||"",message_text:content,message_date:new Date((m.date||Date.now()/1000)*1000).toISOString(),selected_group:bot.display_name},{onConflict:"bot_chat_id,bot_message_id",ignoreDuplicates:true});
 return error?respond({error:"Save failed"},500):respond({ok:true});
}
const auth=req.headers.get("Authorization")||"";
if(!auth.startsWith("Bearer "))return respond({error:"Unauthorized"},401);
const {data:{user}}=await db.auth.getUser(auth.slice(7));if(!user)return respond({error:"Unauthorized"},401);
 if(!await telegramProAllowed(user.id))return respond({error:"Telegram chỉ dành cho PRO / ADMIN",code:"PRO_REQUIRED"},403);
if(req.method==="GET"){const {data,error}=await db.from("telegram_customer_bots").select("id,username,display_name,created_at").eq("user_id",user.id).order("created_at");return error?respond({error:"Failed"},500):respond({success:true,bots:data})}
if(req.method!=="POST")return respond({error:"Method not allowed"},405);
let p:any;try{p=await req.json()}catch{return respond({error:"Bad JSON"},400)}
if(p.action==="connect"){
 const token=String(p.token||"").trim();if(!/^\d{5,15}:[A-Za-z0-9_-]{30,}$/.test(token))return respond({error:"Token không hợp lệ"},400);
 const info=await(await fetch("https://api.telegram.org/bot"+token+"/getMe")).json();
 if(!info.ok||!info.result?.is_bot)return respond({error:"Không xác thực được bot"},400);
 const id=Number(info.result.id),username=String(info.result.username||"");
 const {data:existing}=await db.from("telegram_customer_bots").select("user_id").eq("bot_id",id).maybeSingle();
 if(existing)return respond({error:"Bot này đã được kết nối. Hãy dùng bot khác."},409);
 const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
 const {data:record,error}=await db.from("telegram_customer_bots").insert({user_id:user.id,bot_id:id,username,display_name:String(p.name||username).slice(0,80),token_ciphertext:await enc(token),webhook_secret:secret}).select("id").single();
 if(error)return respond({error:"Không lưu được bot"},500);
 const target=url+"/functions/v1/telegram-customer-bots?bot="+record.id;
 const set=await(await fetch("https://api.telegram.org/bot"+token+"/setWebhook",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:target,secret_token:secret,allowed_updates:["message"],drop_pending_updates:false})})).json();
 if(!set.ok){await db.from("telegram_customer_bots").delete().eq("id",record.id);return respond({error:"Không thiết lập được webhook"},502)}
 return respond({success:true,username});
}
if(p.action==="disconnect"){
 const {data:bot}=await db.from("telegram_customer_bots").select("*").eq("id",p.id).eq("user_id",user.id).maybeSingle();
 if(!bot)return respond({error:"Not found"},404);
 const token=await dec(bot.token_ciphertext);
 const response=await(await fetch("https://api.telegram.org/bot"+token+"/deleteWebhook",{method:"POST"})).json();
 if(!response.ok)return respond({error:"Không thể ngắt webhook"},502);
 await db.from("telegram_customer_bots").delete().eq("id",bot.id).eq("user_id",user.id);
 return respond({success:true});
}
return respond({error:"Unknown action"},400);
});