// Tests the actual SMS-free alias approach against Supabase Local.
// Creates one disposable local auth account. Never point at production.
import {createClient} from '@supabase/supabase-js';
import {createPhoneAliasAuth} from './supabase-phone-alias-auth.mjs';
import {normalizeVietnamesePhone} from './phone-password-core.mjs';
const url=process.env.SUPABASE_LOCAL_URL;
const key=process.env.SUPABASE_LOCAL_ANON_KEY;
const secret=process.env.PHONE_ALIAS_SECRET;
if(!url||!key||!secret)throw Error('Set SUPABASE_LOCAL_URL, SUPABASE_LOCAL_ANON_KEY and PHONE_ALIAS_SECRET');
const parsed=new URL(url);
if(!['localhost','127.0.0.1','::1'].includes(parsed.hostname))throw Error('LOCAL_ONLY_URL_REQUIRED');
if(Buffer.byteLength(secret,'utf8')<32)throw Error('STRONG_ALIAS_SECRET_REQUIRED');
const phone=normalizeVietnamesePhone(process.env.TEST_PHONE||'0912345678');
const password=process.env.TEST_PASSWORD||'Local-only-password-2026!';
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const auth=createPhoneAliasAuth({supabase,aliasSecret:secret,allowStaging:true});
const registered=await auth.register(phone,password);
console.log('REGISTER: PASS; user created in Supabase Local:',registered.userId);
const logged=await auth.login(phone,password);
if(logged.userId!==registered.userId||!logged.session?.access_token)throw Error('LOCAL_ALIAS_LOGIN_FAILED');
console.log('LOGIN: PASS; password session received');
console.log('SMS: NOT USED. PHONE OWNERSHIP: NOT VERIFIED. ACCOUNT: LOCAL TEST ONLY.');
