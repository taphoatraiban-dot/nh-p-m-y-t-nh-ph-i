import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-sync-user,x-sync-key,x-chat-ticket","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const out=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers});
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,"0")).join("");
async function access(uid:string){
 const a=checked(await db.from("telegram_chat_access").select("enabled,worker_seen_at").eq("user_id",uid).maybeSingle());
 return a?.enabled===true?a:null;
}
const uuid=(s:unknown)=>typeof s==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const checked=(r:any)=>{if(r.error)throw r.error;return r.data;};
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return out({error:"Method not allowed"},405);
 if(Deno.env.get("TELEGRAM_CHAT_ENABLED")==="false")return out({error:"Telegram Chat thử nghiệm chưa bật trên máy chủ"},503);
 try{
  const b=await req.json();const action=new URL(req.url).searchParams.get("action")||"read";
  if(action==="claim"||action==="ack"){
   const uid=req.headers.get("x-sync-user")||"",key=req.headers.get("x-sync-key")||"";
   if(!uuid(uid)||key.length<40)return out({error:"Unauthorized"},401);
   const k=checked(await db.from("telegram_member_sync_keys").select("secret_hash").eq("user_id",uid).maybeSingle());
   if(!k||await hash(key)!==k.secret_hash)return out({error:"Unauthorized"},401);
   if(!await access(uid))return out({error:"Tài khoản chưa được bật Chat thử nghiệm"},403);
   if(action==="claim")return out({success:true,jobs:checked(await db.rpc("telegram_chat_claim",{p_user:uid}))});
   if(!uuid(b.id)||!["sent","failed"].includes(b.state))return out({error:"Invalid acknowledgement"},400);
   const job=checked(await db.from("telegram_chat_outbox").select("*").eq("user_id",uid).eq("id",b.id).maybeSingle());
   if(!job)return out({error:"Unknown job"},404);
   if(job.state==="sent")return out({success:true});
   if(job.state!=="sending")return out({error:"Job not claimed"},409);
   if(b.state==="sent"){
    if(!Number.isSafeInteger(b.message_id)||b.message_id<1||typeof b.message_date!=="string"||isNaN(Date.parse(b.message_date)))return out({error:"Invalid Telegram receipt"},400);
    checked(await db.rpc("telegram_member_upsert_messages",{p_user_id:uid,p_messages:[{chat_id:job.chat_id,message_id:b.message_id,message_text:job.message_text,sender_name:"Đã gửi",message_date:b.message_date,edited_at:null}]}));
   }
   checked(await db.from("telegram_chat_outbox").update({state:b.state,message_id:b.state==="sent"?b.message_id:null,error:b.state==="failed"?String(b.error||"Gửi thất bại").slice(0,160):null}).eq("user_id",uid).eq("id",b.id).eq("state","sending"));
   return out({success:true});
  }
  const bearer=req.headers.get("authorization")||"";
  if(!bearer.startsWith("Bearer "))return out({error:"Cần đăng nhập"},401);
  const {data:{user},error}=await db.auth.getUser(bearer.slice(7));
  if(error||!user)return out({error:"Cần đăng nhập"},401);
  const uid=user.id;
  const permission=await access(uid);
  if(!permission)return out({error:"Tài khoản chưa được bật Chat thử nghiệm"},403);
  if(action==="status"){
   const pin=checked(await db.from("telegram_chat_pins").select("user_id").eq("user_id",uid).maybeSingle());
   return out({success:true,has_pin:!!pin});
  }
  if(action==="unlock"){
   if(typeof b.pin!=="string"||!/^\d{4}$/.test(b.pin))return out({error:"PIN phải gồm 4 số"},400);
   const ticket=crypto.randomUUID()+crypto.randomUUID();
   const result=checked(await db.rpc("telegram_chat_unlock",{p_user:uid,p_pin:b.pin,p_ticket_hash:await hash(ticket),p_create:b.create===true}));
   if(!result.success)return out({error:result.error},403);
   return out({...result,ticket});
  }
  const ticket=req.headers.get("x-chat-ticket")||"";
  if(ticket.length!==72)return out({error:"Cần mở khóa Chat bằng PIN"},423);
  const pin=checked(await db.from("telegram_chat_pins").select("expires_at,ticket_hash").eq("user_id",uid).maybeSingle());
  if(!pin||!pin.expires_at||pin.ticket_hash!==await hash(ticket)||Date.parse(pin.expires_at)<=Date.now())return out({error:"PIN Chat đã khóa. Hãy mở lại."},423);
  if(action==="lock"){
   checked(await db.from("telegram_chat_pins").update({ticket_hash:null,expires_at:null}).eq("user_id",uid).eq("ticket_hash",pin.ticket_hash));return out({success:true});
  }
  if(action==="send"){
   if(!permission.worker_seen_at||Date.parse(permission.worker_seen_at)<Date.now()-120000)return out({error:"Bộ gửi Chat đang ngoại tuyến. Thử lại sau."},409);
   if(!uuid(b.id)||!Number.isSafeInteger(b.chat_id)||typeof b.text!=="string"||!b.text.trim()||b.text.length>4096)return out({error:"Tin nhắn không hợp lệ (tối đa 4096 ký tự)"},400);
   const chat=checked(await db.from("telegram_member_groups").select("chat_id,enabled,last_seen_at").eq("user_id",uid).eq("chat_id",b.chat_id).maybeSingle());
   if(!chat||chat.enabled===false)return out({error:"Hội thoại chưa được cấp quyền"},403);
   if(!chat.last_seen_at||Date.parse(chat.last_seen_at)<Date.now()-180000)return out({error:"VPS đang ngoại tuyến. Thử lại khi đồng bộ hoạt động."},409);
   // Duplicate request UUID cannot overwrite or send the text twice.
   checked(await db.from("telegram_chat_outbox").upsert({id:b.id,user_id:uid,chat_id:b.chat_id,message_text:b.text},{onConflict:"id",ignoreDuplicates:true}));
   const job=checked(await db.from("telegram_chat_outbox").select("id,chat_id,message_text,state").eq("user_id",uid).eq("id",b.id).maybeSingle());
   if(!job||job.chat_id!==b.chat_id||job.message_text!==b.text)return out({error:"Mã gửi đã được dùng cho nội dung khác"},409);
   return out({success:true,job});
  }
  if(action==="clear-chat"){
   if(!Number.isSafeInteger(b.chat_id))return out({error:"Hội thoại không hợp lệ"},400);
   const chat=checked(await db.from("telegram_member_groups").select("chat_id,enabled").eq("user_id",uid).eq("chat_id",b.chat_id).maybeSingle());
   if(!chat||chat.enabled===false)return out({error:"Hội thoại chưa được cấp quyền"},403);
   const {data,error}=await db.rpc("clear_telegram_chat",{p_user_id:uid,p_chat_id:b.chat_id});
   if(error)return out({error:error.message},409);
   return out({success:true,cleared_at:data});
  }
  if(action==="hide"){
   if(!Number.isSafeInteger(b.chat_id)||!Array.isArray(b.message_ids)||b.message_ids.length<1||b.message_ids.length>200||!b.message_ids.every((id:unknown)=>Number.isSafeInteger(id)&&Number(id)>0))return out({error:"Danh sách tin cần xóa không hợp lệ"},400);
   const ids=[...new Set(b.message_ids as number[])];
   const chat=checked(await db.from("telegram_member_groups").select("chat_id,enabled").eq("user_id",uid).eq("chat_id",b.chat_id).maybeSingle());
   if(!chat||chat.enabled===false)return out({error:"Hội thoại chưa được cấp quyền"},403);
   const existing=checked(await db.from("telegram_member_messages").select("message_id").eq("user_id",uid).eq("chat_id",b.chat_id).in("message_id",ids));
   if(existing.length!==ids.length)return out({error:"Có tin không tồn tại trong hội thoại"},404);
   checked(await db.from("telegram_member_hidden").upsert(ids.map(id=>({user_id:uid,chat_id:b.chat_id,message_id:id})),{onConflict:"user_id,chat_id,message_id",ignoreDuplicates:true}));
   return out({success:true,hidden:ids.length});
  }
  if(action!=="read")return out({error:"Bad action"},400);
  const groups=checked(await db.from("telegram_member_groups").select("chat_id,group_name,enabled,last_seen_at").eq("user_id",uid).neq("enabled",false).order("group_name"));
  const clearRows=checked(await db.from("telegram_chat_cleared").select("chat_id,cleared_at").eq("user_id",uid));
  const cleared=new Map(clearRows.map((r:any)=>[String(r.chat_id),Date.parse(r.cleared_at)]));
  let messages:any[]=[];let hiddenIds=new Set<number>();
  if(b.chat_id!==undefined){
   if(!Number.isSafeInteger(b.chat_id)||!groups.some((g:any)=>g.chat_id===b.chat_id))return out({error:"Hội thoại chưa được cấp quyền"},403);
   messages=checked(await db.from("telegram_member_messages").select("chat_id,message_id,message_text,sender_name,message_date,edited_at").eq("user_id",uid).eq("chat_id",b.chat_id).order("message_date",{ascending:false}).order("message_id",{ascending:false}).limit(200));
   const hidden=checked(await db.from("telegram_member_hidden").select("message_id").eq("user_id",uid).eq("chat_id",b.chat_id));
   hiddenIds=new Set(hidden.map((m:any)=>m.message_id));messages=messages.filter(m=>!hiddenIds.has(m.message_id)&&Date.parse(m.message_date)>(cleared.get(String(m.chat_id))||0)).reverse();
  }
  let jobs=checked(await db.from("telegram_chat_outbox").select("id,chat_id,message_text,state,message_id,error,created_at").eq("user_id",uid).order("created_at",{ascending:false}).limit(100));
  jobs=jobs.filter((j:any)=>Date.parse(j.created_at)>(cleared.get(String(j.chat_id))||0));
  // Initial reads also carry outbox jobs for other chats. Exclude hidden copies
  // before returning them, so switching chats cannot briefly resurrect a message.
  const jobIds=[...new Set(jobs.map((j:any)=>j.message_id).filter((id:any)=>Number.isSafeInteger(id)))];
  if(jobIds.length){
   const hiddenJobs=checked(await db.from("telegram_member_hidden").select("chat_id,message_id").eq("user_id",uid).in("message_id",jobIds));
   const hiddenKeys=new Set(hiddenJobs.map((h:any)=>h.chat_id+":"+h.message_id));jobs=jobs.filter((j:any)=>!hiddenKeys.has(j.chat_id+":"+j.message_id));
  }
  const notices=checked(await db.from("telegram_member_messages").select("chat_id,message_id,sender_name").eq("user_id",uid).gte("message_date",new Date(Date.now()-48*3600000).toISOString()).order("message_date",{ascending:false}).limit(1000));
  const allowed=new Set(groups.map((g:any)=>g.chat_id));
  return out({success:true,groups,messages,jobs:jobs.filter((j:any)=>j.chat_id!==b.chat_id||!hiddenIds.has(j.message_id)),notices:notices.filter((m:any)=>allowed.has(m.chat_id)&&(m.chat_id!==b.chat_id||!hiddenIds.has(m.message_id)))});
 }catch{ return out({error:"Không thể xử lý Telegram Chat"},500); }
});
