import {createClient} from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
async function telegramProAllowed(db:any,uid:string){
 const {data,error}=await db.rpc("telegram_account_entitled",{p_user_id:uid});
 return !error&&data===true;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(!["GET","POST"].includes(req.method))return respond({error:"Method not allowed"},405);
 const auth=req.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer "))return respond({error:"Unauthorized"},401);
 const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const db=createClient(url,service,{auth:{persistSession:false}});
 const {data:{user},error}=await db.auth.getUser(auth.slice(7));
 if(error||!user)return respond({error:"Unauthorized"},401);
 if(!await telegramProAllowed(db,user.id))return respond({error:"Telegram chỉ dành cho PRO / ADMIN",code:"PRO_REQUIRED"},403);
 const {data:admin,error:ae}=await db.from("admin_users").select("*").eq("user_id",user.id).maybeSingle();

 const {data:ownerLink,error:ownerError}=await db.from("telegram_inbox_account_links").select("owner_telegram_id").eq("user_id",user.id).maybeSingle();
 if(ownerError)return respond({error:"Inbox ownership lookup failed"},500);

 const ownerId=ownerLink?.owner_telegram_id;
 if(req.method==="POST"){
  let p:{action?:string,ids?:unknown};
  try{p=await req.json()}catch{return respond({error:"Invalid JSON"},400)}
  if(p?.action!=="delete"||!Array.isArray(p.ids)||p.ids.length<1||p.ids.length>500||!p.ids.every((x:unknown)=>typeof x==="number"&&Number.isSafeInteger(x)&&x>0))return respond({error:"Invalid ids"},400);
  const {data:deleted,error:de}=await db.from("telegram_forwarded_inbox").delete().in("id",p.ids).or(ownerId?"owner_user_id.eq."+user.id+",and(owner_user_id.is.null,owner_telegram_id.eq."+ownerId+")":"owner_user_id.eq."+user.id).select("id");
  if(de)return respond({error:"Delete failed"},500);
  return respond({success:true,deleted:(deleted||[]).map(x=>x.id)});
 }
 const limit=Math.min(500,Math.max(1,Number(new URL(req.url).searchParams.get("limit"))||200));
 const {data, error:readError}=await db.from("telegram_forwarded_inbox").select("id,selected_group,origin_name,sender_name,message_text,message_date,received_at").or(ownerId?"owner_user_id.eq."+user.id+",and(owner_user_id.is.null,owner_telegram_id.eq."+ownerId+")":"owner_user_id.eq."+user.id).order("message_date",{ascending:false}).limit(limit);
 if(readError)return respond({error:"Query failed"},500);
 return respond({success:true,messages:data||[]});
});