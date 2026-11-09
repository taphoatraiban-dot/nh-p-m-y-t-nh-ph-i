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
  if(action==="claim"||action==="ack"||action==="worker-image"){
   const uid=req.headers.get("x-sync-user")||"",key=req.headers.get("x-sync-key")||"";
   if(!uuid(uid)||key.length<40)return out({error:"Unauthorized"},401);
   const k=checked(await db.from("telegram_member_sync_keys").select("secret_hash").eq("user_id",uid).maybeSingle());
   if(!k||await hash(key)!==k.secret_hash)return out({error:"Unauthorized"},401);
   if(!await access(uid))return out({error:"Tài khoản chưa được bật Chat thử nghiệm"},403);
   if(action==="claim")return out({success:true,jobs:checked(await db.rpc("telegram_chat_claim",{p_user:uid}))});
   if(action==="worker-image"){
    if(!uuid(b.id))return out({error:"Invalid job ID"},400);
    const job=checked(await db.from("telegram_chat_outbox").select("id,media_path,media_mime,state").eq("user_id",uid).eq("id",b.id).maybeSingle());
    if(!job||job.state!=="sending"||!job.media_path||!job.media_path.startsWith(uid+"/"))return out({error:"Image job not claimed"},403);
    const {data:blob,error:downloadError}=await db.storage.from("telegram-chat-media").download(job.media_path);
    if(downloadError||!blob||blob.size>10485760)return out({error:"Image unavailable"},404);
    const bytes=new Uint8Array(await blob.arrayBuffer());
    let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return out({success:true,mime:job.media_mime,data:btoa(binary)});
   }

   if(!uuid(b.id)||!["sent","failed"].includes(b.state))return out({error:"Invalid acknowledgement"},400);
   const job=checked(await db.from("telegram_chat_outbox").select("*").eq("user_id",uid).eq("id",b.id).maybeSingle());
   if(!job)return out({error:"Unknown job"},404);
   if(job.state==="sent")return out({success:true});
   if(job.state!=="sending")return out({error:"Job not claimed"},409);
   if(b.state==="sent"){
    if(!Number.isSafeInteger(b.message_id)||b.message_id<1||typeof b.message_date!=="string"||isNaN(Date.parse(b.message_date)))return out({error:"Invalid Telegram receipt"},400);
    checked(await db.rpc("telegram_member_upsert_messages",{p_user_id:uid,p_messages:[{chat_id:job.chat_id,message_id:b.message_id,message_text:job.message_text,media_path:job.media_path,media_mime:job.media_mime,sender_name:"Đã gửi",message_date:b.message_date,edited_at:null}]}));
    // Legacy RPC deliberately ignores media-only messages and does not persist
    // attachment columns. Store the media receipt explicitly after Telegram ack.
    if(job.media_path){
     checked(await db.from("telegram_member_messages").upsert({
      user_id:uid,chat_id:job.chat_id,message_id:b.message_id,
      message_text:job.message_text||"",sender_name:"Đã gửi",
      message_date:b.message_date,media_path:job.media_path,media_mime:job.media_mime
     },{onConflict:"user_id,chat_id,message_id"}));
    }
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
  if(action==="upload-image"){
   if(!Number.isSafeInteger(b.chat_id)||typeof b.mime!=="string"||!["image/jpeg","image/png","image/webp"].includes(b.mime)||typeof b.data!=="string"||b.data.length>14000000)return out({error:"Ảnh không hợp lệ hoặc vượt quá 10 MB"},400);
   const chat=checked(await db.from("telegram_member_groups").select("chat_id,enabled").eq("user_id",uid).eq("chat_id",b.chat_id).maybeSingle());
   if(!chat||chat.enabled===false)return out({error:"Hội thoại chưa được cấp quyền"},403);
   const decoded=Uint8Array.from(atob(b.data),x=>x.charCodeAt(0));
   if(!decoded.length||decoded.length>10485760)return out({error:"Ảnh vượt quá 10 MB"},400);
   const jpeg=decoded.length>=4&&decoded[0]===255&&decoded[1]===216&&decoded[2]===255&&decoded[decoded.length-2]===255&&decoded[decoded.length-1]===217;
   const png=decoded.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>decoded[i]===v);
   const webp=decoded.length>=16&&[82,73,70,70].every((v,i)=>decoded[i]===v)&&[87,69,66,80].every((v,i)=>decoded[i+8]===v)&&new DataView(decoded.buffer).getUint32(4,true)+8===decoded.length;
   if(!(b.mime==="image/jpeg"&&jpeg||b.mime==="image/png"&&png||b.mime==="image/webp"&&webp))return out({error:"Dữ liệu ảnh không khớp định dạng"},400);
   const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[b.mime as "image/jpeg"|"image/png"|"image/webp"];
   const path=uid+"/"+crypto.randomUUID()+"."+ext;
   const {error:uploadError}=await db.storage.from("telegram-chat-media").upload(path,decoded,{contentType:b.mime,upsert:false});
   if(uploadError)throw uploadError;
   return out({success:true,media_path:path,media_mime:b.mime});
  }
  if(action==="image-url"){
   if(typeof b.media_path!=="string"||!b.media_path.startsWith(uid+"/")||b.media_path.includes(".."))return out({error:"Đường dẫn ảnh không hợp lệ"},403);
   const linkedMessage=checked(await db.from("telegram_member_messages").select("message_id").eq("user_id",uid).eq("media_path",b.media_path).gte("message_date",new Date(Date.now()-48*3600000).toISOString()).limit(1));
   const linkedJob=checked(await db.from("telegram_chat_outbox").select("id").eq("user_id",uid).eq("media_path",b.media_path).gte("created_at",new Date(Date.now()-48*3600000).toISOString()).limit(1));
   if(!linkedMessage.length&&!linkedJob.length)return out({error:"Ảnh chưa thuộc tin nhắn hợp lệ hoặc đã hết hạn"},403);
   const {data,error:signError}=await db.storage.from("telegram-chat-media").createSignedUrl(b.media_path,60);
   if(signError||!data?.signedUrl)return out({error:"Không tìm thấy ảnh"},404);
   return out({success:true,url:data.signedUrl,expires_in:60});
  }
  if(action==="send"){
   if(!permission.worker_seen_at||Date.parse(permission.worker_seen_at)<Date.now()-120000)return out({error:"Bộ gửi Chat đang ngoại tuyến. Thử lại sau."},409);
   if(!uuid(b.id)||!Number.isSafeInteger(b.chat_id)||typeof b.text!=="string"||(!b.text.trim()&&!b.media_path)||b.text.length>4096)return out({error:"Tin nhắn không hợp lệ (tối đa 4096 ký tự)"},400);
   const chat=checked(await db.from("telegram_member_groups").select("chat_id,enabled,last_seen_at").eq("user_id",uid).eq("chat_id",b.chat_id).maybeSingle());
   if(!chat||chat.enabled===false)return out({error:"Hội thoại chưa được cấp quyền"},403);
   if(!chat.last_seen_at||Date.parse(chat.last_seen_at)<Date.now()-180000)return out({error:"VPS đang ngoại tuyến. Thử lại khi đồng bộ hoạt động."},409);
   const hasImage=typeof b.media_path==="string"&&b.media_path.length>0;
   if(hasImage){
    if(!b.media_path.startsWith(uid+"/")||b.media_path.includes("..")||typeof b.media_mime!=="string"||!["image/jpeg","image/png","image/webp"].includes(b.media_mime))return out({error:"Ảnh đính kèm không hợp lệ"},400);
    const {data:object,error:objectError}=await db.storage.from("telegram-chat-media").info(b.media_path);
    if(objectError||!object||object.contentType!==b.media_mime)return out({error:"Không tìm thấy ảnh đính kèm hợp lệ"},404);
   }
   // Duplicate request UUID cannot overwrite or send the text twice.
   checked(await db.from("telegram_chat_outbox").upsert({id:b.id,user_id:uid,chat_id:b.chat_id,message_text:b.text,media_path:hasImage?b.media_path:null,media_mime:hasImage?b.media_mime:null},{onConflict:"id",ignoreDuplicates:true}));
   const job=checked(await db.from("telegram_chat_outbox").select("id,chat_id,message_text,media_path,media_mime,state").eq("user_id",uid).eq("id",b.id).maybeSingle());
   if(!job||job.chat_id!==b.chat_id||job.message_text!==b.text||job.media_path!==(hasImage?b.media_path:null))return out({error:"Mã gửi đã được dùng cho nội dung khác"},409);
   return out({success:true,job});
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
  let messages:any[]=[];let hiddenIds=new Set<number>();
  if(b.chat_id!==undefined){
   if(!Number.isSafeInteger(b.chat_id)||!groups.some((g:any)=>g.chat_id===b.chat_id))return out({error:"Hội thoại chưa được cấp quyền"},403);
   messages=checked(await db.from("telegram_member_messages").select("chat_id,message_id,message_text,sender_name,message_date,edited_at,media_path,media_mime").eq("user_id",uid).eq("chat_id",b.chat_id).order("message_date",{ascending:false}).order("message_id",{ascending:false}).limit(200));
   const hidden=checked(await db.from("telegram_member_hidden").select("message_id").eq("user_id",uid).eq("chat_id",b.chat_id));
   hiddenIds=new Set(hidden.map((m:any)=>m.message_id));messages=messages.filter(m=>!hiddenIds.has(m.message_id)).reverse();
  }
  let jobs=checked(await db.from("telegram_chat_outbox").select("id,chat_id,message_text,media_path,media_mime,state,message_id,error,created_at").eq("user_id",uid).order("created_at",{ascending:false}).limit(100));
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
