// Local Supabase Auth smoke test. Never point at production.
// Requires locally running Supabase and a LOCAL publishable/anon key.
// Creates a disposable local account; no production writes.
import {normalizeVietnamesePhone} from './phone-password-core.mjs';
const url=process.env.SUPABASE_LOCAL_URL;
const key=process.env.SUPABASE_LOCAL_ANON_KEY;
if(!url||!key)throw Error('Set SUPABASE_LOCAL_URL and SUPABASE_LOCAL_ANON_KEY');
const parsed=new URL(url);
if(!['localhost','127.0.0.1','::1'].includes(parsed.hostname))throw Error('LOCAL_ONLY_URL_REQUIRED');
const phone=normalizeVietnamesePhone(process.env.TEST_PHONE||'0912345678');
const password=process.env.TEST_PASSWORD||'Local-only-password-2026!';
const headers={'Content-Type':'application/json',apikey:key};
async function call(path,body){
 const response=await fetch(new URL(path,url),{method:'POST',headers,body:JSON.stringify(body)});
 const json=await response.json().catch(()=>({}));
 return {status:response.status,body:json};
}
const signup=await call('/auth/v1/signup',{phone,password});
console.log('signup',signup.status,signup.body?.msg||signup.body?.error_code||'response received');
if(signup.status>=400){console.error('Local phone signup unavailable; check local Auth phone configuration.');process.exitCode=1;}
else{
 const login=await call('/auth/v1/token?grant_type=password',{phone,password});
 console.log('login',login.status,login.body?.access_token?'SESSION_RECEIVED':'NO_SESSION');
 if(login.status>=400||!login.body?.access_token)process.exitCode=1;
}
