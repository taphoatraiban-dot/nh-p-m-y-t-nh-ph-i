import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"https://cuncun.icu","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const send=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const url=Deno.env.get("SUPABASE_URL")!,pub=Deno.env.get("SUPABASE_ANON_KEY")!,secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
async function telegramProAllowed(uid:string){
 const {data,error}=await admin.rpc("telegram_account_entitled",{p_user_id:uid});
 return !error&&data===true;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("",{headers:cors});
 const action=new URL(req.url).searchParams.get("action");
 const methods:Record<string,string>={capabilities:"GET",probe:"GET",start:"POST",confirm:"POST",password:"POST",groups:"GET",selection:"GET",select:"POST",status:"GET",logout:"POST"};
 if(!action||!methods[action])return send({success:false,error:"Not found"},404);
 if(req.method!==methods[action])return send({success:false,error:"Method not allowed"},405);
 const jwt=(req.headers.get("authorization")||"").replace(/^Bearer /i,"").trim();
 if(!jwt)return send({success:false,error:"Authentication required"},401);
 try{
  const caller=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await caller.auth.getUser(jwt);
  if(error||!user)return send({success:false,error:"Unauthorized"},401);
  if(!await telegramProAllowed(user.id))return send({success:false,error:"Telegram chỉ dành cho PRO / ADMIN",code:"PRO_REQUIRED"},403);
  const id=Deno.env.get("CF_ACCESS_CLIENT_ID")||"",key=Deno.env.get("CF_ACCESS_CLIENT_SECRET")||"";
  if(!id||!key)return send(action==="capabilities"?{success:true,licensed:true,self_service_enabled:false,otp_flow_ready:false,telegram_login_enabled:false,reason:"Cloudflare credentials not configured"}:{success:false,error:"VPS connector not configured"},action==="capabilities"?200:503);
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),8000);
  const headers:Record<string,string>={"CF-Access-Client-Id":id,"CF-Access-Client-Secret":key};
  let path="/health",body:string|undefined;
  if(action==="start"||action==="confirm"||action==="password"||action==="select"||action==="logout"){
   path=action==="select"?"/telegram-login/groups/select":"/telegram-login/"+action;headers["authorization"]="Bearer "+jwt;headers["content-type"]="application/json";
   const json=await req.json().catch(()=>null);
   if(!json||typeof json!=="object"||Array.isArray(json)||JSON.stringify(json).length>512)return send({success:false,error:"Invalid request"},400);
   body=JSON.stringify(json);
  }
  if(action==="groups"||action==="selection"||action==="status"){
   path=action==="groups"?"/telegram-login/groups":action==="selection"?"/telegram-login/groups/selection":"/telegram-login/status";
   headers["authorization"]="Bearer "+jwt;
  }
  try{
   const resp=await fetch("https://telegram.cuncun.icu"+path,{method:body?"POST":"GET",headers,body,redirect:"manual",signal:ctrl.signal});
   const result=await resp.json().catch(()=>null);
   if(action==="capabilities"||action==="probe"){
    const connected=resp.ok&&result?.service==="telegram-selfservice"&&result?.success===true;
    const enabled=connected&&result?.telegram_login_enabled===true;
    return send(action==="probe"?{success:true,configured:true,connected,telegram_login_enabled:enabled}:{success:true,licensed:true,self_service_enabled:enabled,otp_flow_ready:enabled,telegram_login_enabled:enabled,reason:enabled?"Ready":"VPS login service not ready"});
   }
   if(!resp.ok)return send({success:false,error:typeof result?.detail==="string"?result.detail:"Telegram service unavailable"},[400,401,403,409,429].includes(resp.status)?resp.status:502);
   if(action==="groups"||action==="selection"||action==="status"||action==="select"||action==="logout")return send(result??{success:false,error:"Empty VPS response"});
   return send({success:result?.success===true,step:result?.step,expires_in:result?.expires_in});
  }finally{clearTimeout(timer);}
 }catch(e){console.error("Telegram self-service",e instanceof Error?e.name:"Error");return send({success:false,error:"Service temporarily unavailable"},503);}
});
