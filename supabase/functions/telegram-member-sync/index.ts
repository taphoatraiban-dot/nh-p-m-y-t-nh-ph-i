import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-sync-user,x-sync-key","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:cors});
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))).map(b=>b.toString(16).padStart(2,"0")).join("");
Deno.serve(async(req)=>{
if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
if(!["GET","POST"].includes(req.method))return out({error:"Method not allowed"},405);
const action=new URL(req.url).searchParams.get("action")||"read";
try {
let userId="";
if(action==="ingest"){
 userId=req.headers.get("x-sync-user")||"";
 const key=req.headers.get("x-sync-key")||"";
 if(!/^[0-9a-f-]{36}$/i.test(userId)||key.length<40)return out({error:"Unauthorized"},401);
 const {data:k}=await db.from("telegram_member_sync_keys").select("secret_hash").eq("user_id",userId).maybeSingle();
 if(!k||await hash(key)!==k.secret_hash)return out({error:"Unauthorized"},401);
 const b=await req.json();
 if(!Array.isArray(b.groups)||b.groups.length>300||!Array.isArray(b.messages)||b.messages.length>200)return out({error:"Invalid batch"},400);
 const groups=b.groups.filter((g:any)=>Number.isSafeInteger(g.chat_id)&&typeof g.group_name==="string"&&g.group_name.length<=200).map((g:any)=>({user_id:userId,chat_id:g.chat_id,group_name:g.group_name,last_seen_at:new Date().toISOString()}));
 if(groups.length){const {error}=await db.from("telegram_member_groups").upsert(groups,{onConflict:"user_id,chat_id",ignoreDuplicates:false});if(error)throw error;}
 const valid=b.messages.filter((m:any)=>Number.isSafeInteger(m.chat_id)&&Number.isSafeInteger(m.message_id)&&typeof m.message_text==="string"&&m.message_text.length<=20000&&typeof m.message_date==="string"&&!isNaN(Date.parse(m.message_date))&&(m.edited_at==null||(typeof m.edited_at==="string"&&!isNaN(Date.parse(m.edited_at)))));
 const unique=new Map<string,any>();
 for(const m of valid){
  const item={chat_id:m.chat_id,message_id:m.message_id,message_text:m.message_text,sender_name:String(m.sender_name||"").slice(0,150),message_date:m.message_date,edited_at:m.edited_at||null};
  const id=`${item.chat_id}:${item.message_id}`,prev=unique.get(id);
  if(!prev||(item.edited_at&&(!prev.edited_at||Date.parse(item.edited_at)>Date.parse(prev.edited_at))))unique.set(id,item);
 }
 const msgs=[...unique.values()];
 if(msgs.length){const {error}=await db.rpc("telegram_member_upsert_messages",{p_user_id:userId,p_messages:msgs});if(error)throw error;}
 return out({success:true,groups:groups.length,messages:msgs.length});
}
const bearer=req.headers.get("authorization")||"";
if(!bearer.startsWith("Bearer "))return out({error:"Unauthorized"},401);
const {data:{user},error:authErr}=await db.auth.getUser(bearer.slice(7));if(authErr||!user)return out({error:"Unauthorized"},401);
userId=user.id;
if(action==="rotate-key"&&req.method==="POST"){
 const bytes=crypto.getRandomValues(new Uint8Array(32));const secret=Array.from(bytes).map(x=>x.toString(16).padStart(2,"0")).join("");
 const {error}=await db.from("telegram_member_sync_keys").upsert({user_id:userId,secret_hash:await hash(secret)},{onConflict:"user_id"});if(error)throw error;
 return out({success:true,user_id:userId,sync_key:secret});
}
if((action==="hide-chat"||action==="restore-chat")&&req.method==="POST"){
 const b=await req.json();
 if(!Number.isSafeInteger(b.chat_id))return out({error:"Invalid chat ID"},400);
 const {data:chat,error:lookupErr}=await db.from("telegram_member_groups").select("chat_id").eq("user_id",userId).eq("chat_id",b.chat_id).maybeSingle();
 if(lookupErr)throw lookupErr;
 if(!chat)return out({error:"Chat not found"},404);
 const {error:changeErr}=await db.from("telegram_member_groups").update({enabled:action==="restore-chat"}).eq("user_id",userId).eq("chat_id",b.chat_id);
 if(changeErr)throw changeErr;
 return out({success:true,chat_id:b.chat_id,enabled:action==="restore-chat"});
}
if(action==="hide"&&req.method==="POST"){
 const b=await req.json();
 if(!Array.isArray(b.ids)||b.ids.length<1||b.ids.length>1000||!b.ids.every((x:any)=>Number.isSafeInteger(x.chat_id)&&Number.isSafeInteger(x.message_id)))return out({error:"Invalid message identifiers"},400);
 const unique=new Map(b.ids.map((x:any)=>[String(x.chat_id)+":"+String(x.message_id),{user_id:userId,chat_id:x.chat_id,message_id:x.message_id}]));
 const ids=[...unique.values()] as {user_id:string,chat_id:number,message_id:number}[];
 for(let i=0;i<ids.length;i+=100){
   const chunk=ids.slice(i,i+100);
   const {data:found,error:fe}=await db.from("telegram_member_messages").select("chat_id,message_id").eq("user_id",userId).in("chat_id",[...new Set(chunk.map(x=>x.chat_id))]).in("message_id",[...new Set(chunk.map(x=>x.message_id))]);
   if(fe)throw fe;
   const allowed=new Set((found||[]).map((x:any)=>x.chat_id+":"+x.message_id));
   if(chunk.some(x=>!allowed.has(x.chat_id+":"+x.message_id)))return out({error:"Message is not available"},400);
 }
 const {error:he}=await db.from("telegram_member_hidden").upsert(ids,{onConflict:"user_id,chat_id,message_id",ignoreDuplicates:true});
 if(he)throw he;
 return out({success:true,hidden:ids.length});
}
if(action!=="read"||req.method!=="GET")return out({error:"Bad action"},400);
const [g,m,k,h]=await Promise.all([
 db.from("telegram_member_groups").select("chat_id,group_name,enabled,last_seen_at").eq("user_id",userId).order("group_name"),
 db.from("telegram_member_messages").select("chat_id,message_id,message_text,sender_name,message_date,edited_at").eq("user_id",userId).gte("message_date",new Date(Date.now()-48*3600000).toISOString()).order("message_date",{ascending:false}).limit(1000),
 db.from("telegram_member_sync_keys").select("created_at").eq("user_id",userId).maybeSingle(),
 db.from("telegram_member_hidden").select("chat_id,message_id").eq("user_id",userId)
]);
if(g.error||m.error||k.error||h.error)throw(g.error||m.error||k.error||h.error);
const hidden=new Set((h.data||[]).map((x:any)=>x.chat_id+":"+x.message_id));
const hiddenChats=new Set((g.data||[]).filter((x:any)=>x.enabled===false).map((x:any)=>String(x.chat_id)));
return out({success:true,configured:!!k.data,groups:g.data||[],messages:(m.data||[]).filter((x:any)=>!hidden.has(x.chat_id+":"+x.message_id)&&!hiddenChats.has(String(x.chat_id)))});
}catch(e){console.error("telegram member sync",e);return out({error:"Request failed"},500);}
});
