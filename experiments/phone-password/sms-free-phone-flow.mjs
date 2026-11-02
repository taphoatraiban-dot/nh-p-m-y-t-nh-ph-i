// Experimental SMS-free login flow. Server-only, not deployed to production.
// Requires separate, server-side rate limiting and registration abuse protection.
import {createPhoneAliasAuth} from './supabase-phone-alias-auth.mjs';
import {createPhoneLicenseLookup} from './supabase-phone-license-lookup.mjs';
import {createSupabasePhoneAccountGate} from './supabase-phone-account-gate.mjs';

export function createSmsFreePhoneFlow({supabase,serverAuthClient,serverDb,aliasSecret,clock,allowStaging=false}={}){
 const alias=createPhoneAliasAuth({supabase,aliasSecret,allowStaging});
 const approvedAccess=createPhoneLicenseLookup({db:serverDb,clock});
 const gate=createSupabasePhoneAccountGate({authClient:serverAuthClient,profileDb:serverDb,approvedAccess});
 return {
  register:(phone,password)=>alias.register(phone,password),
  async login(phone,password){
   const result=await alias.login(phone,password);
   const permission=await gate(result.session.access_token);
   if(!permission.allowed)return {allowed:false,reason:permission.reason,session:null};
   if(permission.userId!==result.userId)return {allowed:false,reason:'IDENTITY_MISMATCH',session:null};
   return {allowed:true,reason:'APPROVED',session:result.session,userId:result.userId};
  }
 };
}
