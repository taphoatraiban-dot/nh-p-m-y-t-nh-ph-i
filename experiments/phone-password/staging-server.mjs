// Isolated staging server. Never deploy without TLS, persistent rate limiting,
// CSRF/origin protection, audit logs and an explicit production security review.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {createPhoneAliasAuth} from './supabase-phone-alias-auth.mjs';
import {createProductionLicenseRpcGate} from './production-license-rpc-gate.mjs';
import {createLocalPhoneRateLimiter} from './local-phone-rate-limit.mjs';

const required=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','PHONE_ALIAS_SECRET'];
for(const name of required)if(!process.env[name])throw new Error('MISSING_'+name);
if(process.env.STAGING_ONLY!=='true')throw new Error('STAGING_ONLY');
const url=new URL(process.env.SUPABASE_URL);
if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('LOCAL_SUPABASE_ONLY');
const port=Number(process.env.PORT||8787);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error('INVALID_PORT');
const anon=createClient(url.href,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const phoneAuth=createPhoneAliasAuth({supabase:anon,aliasSecret:process.env.PHONE_ALIAS_SECRET,allowStaging:true});
const licenseGate=createProductionLicenseRpcGate({userClientFactory:async token=>createClient(url.href,process.env.SUPABASE_PUBLISHABLE_KEY,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}})});
const limit=createLocalPhoneRateLimiter({maxAttempts:5});
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function clientKey(req){return req.socket.remoteAddress||'unknown';}
const server=http.createServer(async(req,res)=>{
 try{
  const origin=req.headers.origin;
  if(origin&&origin!=='http://127.0.0.1:'+port&&origin!=='http://localhost:'+port)return json(res,403,{message:'Nguồn yêu cầu không hợp lệ'});
  if(req.method==='GET'&&req.url==='/'){const html=await readFile(new URL('./staging-login.html',import.meta.url));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(html);}
  if(req.method!=='POST'||!/^\/api\/staging-auth\/(phone|email)\/(register|login)$/.test(req.url||''))return json(res,404,{message:'Không tìm thấy chức năng'});
  const [,mode,action]=req.url.match(/^\/api\/staging-auth\/(phone|email)\/(register|login)$/);
  if(mode==='email'&&action==='register')return json(res,404,{message:'Chỉ thử nghiệm đăng ký SĐT'});
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(clientKey(req)))return json(res,403,{message:'Chỉ cho phép truy cập trên máy thử nghiệm'});
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return json(res,413,{message:'Yêu cầu quá lớn'});}
  const body=JSON.parse(raw);if(typeof body.identity!=='string'||typeof body.password!=='string')return json(res,400,{message:'Dữ liệu không hợp lệ'});
  const throttle=limit(clientKey(req)+':'+mode+':'+action);if(!throttle.allowed)return json(res,429,{message:'Thử lại sau 15 phút'});
  if(mode==='phone'){
   if(action==='register'){await phoneAuth.register(body.identity,body.password);return json(res,200,{message:'Đã gửi yêu cầu đăng ký. Chờ quản trị viên duyệt.'});}
   const result=await phoneAuth.login(body.identity,body.password);
   const access=await licenseGate({accessToken:result.session.access_token,expectedUserId:result.userId});
   if(!access.allowed)return json(res,403,{message:'Tài khoản chưa được duyệt hoặc chưa có giấy phép hợp lệ.'});
   // Do not return tokens or set cookies until server-side session design is reviewed.
   return json(res,200,{message:'Xác thực SĐT và bản quyền thành công (chỉ thử nghiệm, chưa tạo phiên ứng dụng).'});
  }
  const {data,error}=await anon.auth.signInWithPassword({email:body.identity,password:body.password});
  if(error||!data?.user?.id||!data?.session?.access_token)return json(res,401,{message:'Email hoặc mật khẩu không đúng'});
  // Email login is only a credential smoke test. It MUST NOT grant app access.
  // Existing email login and license logic remain in the production app.
  return json(res,200,{message:'Xác thực Email thành công (chỉ kiểm thử, chưa cấp quyền truy cập).'});
 }catch(e){return json(res,400,{message:'Không thể xử lý yêu cầu. Kiểm tra dữ liệu và cấu hình Local.'});}
});
server.listen(port,'127.0.0.1',()=>process.stdout.write('Local staging: http://127.0.0.1:'+port+'\n'));
