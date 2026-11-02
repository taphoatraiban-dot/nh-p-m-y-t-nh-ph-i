// Staging-only phone-as-username adapter. Server-side only: NEVER ship the secret or module to a browser.
// Uses Supabase Email/Password Auth with a synthetic, deterministic email identity.
// This is NOT proof of ownership of the telephone number.
import {createHmac} from 'node:crypto';
import {normalizeVietnamesePhone,validatePassword} from './phone-password-core.mjs';

export function createPhoneAliasAuth({supabase,aliasSecret,allowStaging=false}={}){
 if(allowStaging!==true)throw new Error('STAGING_ONLY');
 if(typeof aliasSecret!=='string'||Buffer.byteLength(aliasSecret,'utf8')<32)throw new Error('STRONG_ALIAS_SECRET_REQUIRED');
 if(typeof supabase?.auth?.signUp!=='function'||typeof supabase?.auth?.signInWithPassword!=='function')throw new TypeError('SUPABASE_AUTH_REQUIRED');
 const emailFor=(phone)=>{
  const normalized=normalizeVietnamesePhone(phone);
  const digest=createHmac('sha256',aliasSecret).update('cuncun-phone-alias-v1:'+normalized).digest('hex');
  return 'phone-'+digest+'@accounts.invalid';
 };
 return {
  // Must be called only from an authenticated, rate-limited server endpoint.
  // Local Auth must auto-confirm synthetic email identities. Never send email to this address.
  async register(phone,password){
   validatePassword(password);
   const email=emailFor(phone);
   const {data,error}=await supabase.auth.signUp({email,password});
   if(error)throw new Error('REGISTRATION_FAILED');
   if(!data?.user?.id)throw new Error('REGISTRATION_FAILED');
   return {userId:data.user.id,approvalRequired:true};
  },
  async login(phone,password){
   validatePassword(password);
   const email=emailFor(phone);
   const {data,error}=await supabase.auth.signInWithPassword({email,password});
   if(error||!data?.session?.access_token||!data?.user?.id)throw new Error('INVALID_CREDENTIALS');
   return {userId:data.user.id,session:data.session};
  }
 };
}
