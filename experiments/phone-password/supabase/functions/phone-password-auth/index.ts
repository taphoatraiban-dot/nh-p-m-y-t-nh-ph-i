import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const ALIAS_SECRET = Deno.env.get("PHONE_ALIAS_SECRET")!;
if (new TextEncoder().encode(ALIAS_SECRET).length < 32) throw new Error("PHONE_ALIAS_SECRET must contain at least 32 bytes");
import { resolveAvailablePlan } from "../../../subscription-plans.ts";
const ALLOWED = new Set(["https://cuncun.icu","https://www.cuncun.icu","http://localhost:8787","http://127.0.0.1:8787"]);
const adminDb = createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const json=(status:number,body:unknown,origin:string|null)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":origin&&ALLOWED.has(origin)?origin:"null","vary":"Origin","access-control-allow-headers":"authorization, apikey, content-type","access-control-allow-methods":"POST, OPTIONS"}});
function normalize(v:unknown){let p=String(v??"").replace(/[\s().-]/g,"");if(/^0[0-9]{9}$/.test(p))p="+84"+p.slice(1);if(!/^\+84[35789][0-9]{8}$/.test(p))throw new Error("INVALID_PHONE");return p;}
async function rateLimit(action:string,phone:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("cuncun-phone-rate-v1:"+action+":"+phone));const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");const {data,error}=await adminDb.rpc("phone_auth_consume_rate_limit",{p_key_hash:hash,p_max_attempts:5,p_window_seconds:900});if(error||data!==true)throw new Error("RATE_LIMITED");}
function addMonthsClamped(base:Date,count:number){const d=new Date(base);const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+count);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d;}
async function alias(phone:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(ALIAS_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode("cuncun-phone-alias-v1:"+phone));return "phone-"+Array.from(new Uint8Array(sig),b=>b.toString(16).padStart(2,"0")).join("")+"@accounts.invalid";}
async function verifyAdmin(req:Request){const token=(req.headers.get("authorization")??"").replace(/^Bearer /,"");if(token.length<20||token.length>8192)throw new Error("ADMIN_REQUIRED");const client=createClient(URL,ANON,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.auth.getUser(token);if(error||!data.user)throw new Error("ADMIN_REQUIRED");const {data:membership,error:me}=await adminDb.from("admin_users").select("user_id").eq("user_id",data.user.id).maybeSingle();if(me||!membership)throw new Error("ADMIN_REQUIRED");return {id:data.user.id,client};}
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin");if(req.method==="OPTIONS")return new Response("ok",{headers:{"access-control-allow-origin":origin&&ALLOWED.has(origin)?origin:"null","access-control-allow-headers":"authorization, apikey, content-type","access-control-allow-methods":"POST, OPTIONS","vary":"Origin"}});
 if(!origin||!ALLOWED.has(origin))return json(403,{error:"ORIGIN_NOT_ALLOWED"},origin);
 if(req.method!=="POST")return json(405,{error:"METHOD_NOT_ALLOWED"},origin);
 try{
  const body=await req.json();if(!body||typeof body!=="object"||Array.isArray(body))return json(400,{error:"INVALID_INPUT"},origin);
  if(body.action==="register"||body.action==="login"){
   const phone=normalize(body.phone),password=String(body.password??"");if(password.length<12||password.length>128)return json(400,{error:"INVALID_PASSWORD"},origin);if(body.action==="register"){try{resolveAvailablePlan(body.plan_id);}catch(e){return json(400,{error:e instanceof Error?e.message:"INVALID_PLAN"},origin);}}
   await rateLimit(body.action,phone);
   const email=await alias(phone);
   if(body.action==="register"){
    const {data,error}=await adminDb.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{phone_verified:false},app_metadata:{auth_method:"phone_alias",requested_plan_id:String(body.plan_id)}});
    if(error||!data.user)return json(409,{error:"REGISTRATION_FAILED"},origin);
    const {error:insertError}=await adminDb.from("phone_auth_accounts").insert({user_id:data.user.id,phone_e164:phone,status:"pending"});
    if(insertError){await adminDb.auth.admin.deleteUser(data.user.id);return json(500,{error:"REGISTRATION_FAILED"},origin);}
    return json(200,{success:true,status:"pending",message:"Đăng ký thành công. Chờ Admin duyệt bản quyền."},origin);
   }
   const client=createClient(URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.auth.signInWithPassword({email,password});if(error||!data.session)return json(401,{error:"INVALID_CREDENTIALS"},origin);
   // A valid password alone must never grant application access.
   // A password sign-in issues a session before the license is checked. Revoke
   // that session when authorization fails instead of leaving it usable.
   const rejectLogin=async(reason:string)=>{try{const {error:signOutError}=await client.auth.signOut({scope:"global"});if(signOutError)console.error("PHONE_SESSION_CLEANUP_FAILED",signOutError.message);}catch(e){console.error("PHONE_SESSION_CLEANUP_FAILED",e);}return json(403,{error:reason},origin);};
   if(data.user.app_metadata?.auth_method!=="phone_alias"||data.user.email!==email)return await rejectLogin("PHONE_IDENTITY_INVALID");
   const {data:account,error:accountError}=await adminDb.from("phone_auth_accounts").select("status").eq("user_id",data.user.id).maybeSingle();
   if(accountError)return await rejectLogin("LICENSE_CHECK_FAILED");
   if(!account||account.status!=="approved")return await rejectLogin("LICENSE_NOT_APPROVED");
   const {data:license,error:licenseError}=await adminDb.from("licenses").select("active,expires_at").eq("user_id",data.user.id).maybeSingle();
   if(licenseError||!license||license.active!==true||(license.expires_at!==null&&(!Number.isFinite(Date.parse(license.expires_at))||Date.parse(license.expires_at)<=Date.now())))return await rejectLogin("LICENSE_INACTIVE");
   return json(200,{session:data.session,user:{id:data.user.id},message:"Đăng nhập thành công; bản quyền đang hoạt động."},origin);
  }
  if(body.action==="admin_login"){
   const email=String(body.email??"").trim(),password=String(body.password??"");
   if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||password.length<1||password.length>128)return json(400,{error:"INVALID_CREDENTIALS"},origin);
   await rateLimit("admin_login",email.toLowerCase());
   const client=createClient(URL,ANON,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await client.auth.signInWithPassword({email,password});
   if(error||!data.session||!data.user)return json(401,{error:"INVALID_CREDENTIALS"},origin);
   const {data:member,error:membershipError}=await adminDb.from("admin_users").select("user_id").eq("user_id",data.user.id).maybeSingle();
   if(membershipError||!member){
    try{const {error:cleanupError}=await client.auth.signOut({scope:"global"});if(cleanupError)console.error("ADMIN_SESSION_CLEANUP_FAILED",cleanupError.message);}catch(e){console.error("ADMIN_SESSION_CLEANUP_FAILED",e);}
    return json(membershipError?503:403,{error:membershipError?"ADMIN_CHECK_FAILED":"ADMIN_REQUIRED"},origin);
   }
   return json(200,{session:data.session,user:{id:data.user.id}},origin);
  }
  if(body.action==="check_access"){
   const token=(req.headers.get("authorization")??"").replace(/^Bearer /,"");
   if(token.length<20||token.length>8192)return json(401,{error:"AUTH_REQUIRED"},origin);
   const {data:identity,error:identityError}=await adminDb.auth.getUser(token);
   if(identityError||!identity.user)return json(401,{error:"AUTH_REQUIRED"},origin);
   const {data:account,error:accountError}=await adminDb.from("phone_auth_accounts").select("status").eq("user_id",identity.user.id).maybeSingle();
   if(accountError)return json(503,{error:"LICENSE_CHECK_FAILED"},origin);
   // Phone identities must never fall back to the legacy Gmail authorization path.
   const phoneIdentity=identity.user.app_metadata?.auth_method==="phone_alias"||identity.user.app_metadata?.cuncun_auth_type==="phone_password"||/^phone-.*@accounts\.invalid$/i.test(identity.user.email??"");
   if(!account&&phoneIdentity)return json(403,{error:"PHONE_ACCOUNT_NOT_FOUND"},origin);
   // Never let a legacy Gmail identity inherit a phone-only approval record.
   if(account&&!phoneIdentity)return json(403,{error:"PHONE_IDENTITY_MISMATCH"},origin);
   if(account){
    if(account.status!=="approved")return json(403,{error:"LICENSE_NOT_APPROVED"},origin);
    const {data:license,error:licenseError}=await adminDb.from("licenses").select("active,expires_at").eq("user_id",identity.user.id).maybeSingle();
    if(licenseError)return json(503,{error:"LICENSE_CHECK_FAILED"},origin);
    if(!license||license.active!==true||(license.expires_at!==null&&(!Number.isFinite(Date.parse(license.expires_at))||Date.parse(license.expires_at)<=Date.now())))return json(403,{error:"LICENSE_INACTIVE"},origin);
    return json(200,{active:true,expires_at:license.expires_at},origin);
   }
   // Do not modify legacy Gmail authorization behavior: it remains on check_email_license().
   return json(400,{error:"USE_LEGACY_LICENSE_CHECK"},origin);
  }
  if(!["list_pending","list_accounts","approve","deny","revoke"].includes(body.action))return json(400,{error:"INVALID_ACTION"},origin);
  const {id:adminId}=await verifyAdmin(req);
  if(body.action==="list_pending"||body.action==="list_accounts"){
   const query=adminDb.from("phone_auth_accounts").select("user_id,phone_e164,status,created_at").order("created_at",{ascending:false}).limit(100);
   const {data,error}=body.action==="list_pending"?await query.eq("status","pending"):await query;
   if(error)throw new Error("QUERY_FAILED");return json(200,{accounts:data??[]},origin);
  }
  const userId=String(body.user_id??"");if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId))return json(400,{error:"INVALID_USER"},origin);
  if(!["approve","deny","revoke"].includes(body.action))return json(400,{error:"INVALID_ACTION"},origin);
  const term=String(body.term??"1m");
  if(body.action==="approve"&&!["1m","3m","6m","12m"].includes(term))return json(400,{error:"INVALID_TERM"},origin);
  // One database statement: license, status and audit either all commit or all roll back.
  const {data:result,error:transitionError}=await adminDb.rpc("phone_auth_admin_transition",{
   p_admin_id:adminId,p_user_id:userId,p_action:body.action,p_term:body.action==="approve"?term:null
  });
  if(transitionError)throw new Error("ADMIN_TRANSITION_FAILED");
  return json(200,result,origin);
 }catch(e){const msg=e instanceof Error?e.message:"INTERNAL_ERROR";return json(msg==="ADMIN_REQUIRED"?403:msg==="RATE_LIMITED"?429:400,{error:msg},origin);}
});
