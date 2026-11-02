// Staging-only composition. Does not change existing email login or production RLS.
import {createNativePhoneAuth} from './supabase-native-phone-auth.mjs';
import {createPhoneLicenseLookup} from './supabase-phone-license-lookup.mjs';
import {createSupabasePhoneAccountGate} from './supabase-phone-account-gate.mjs';
export function createSupabasePhoneFlow({supabase,serverAuthClient,serverDb,clock,allowStaging=false}={}){
 const native=createNativePhoneAuth({supabase,allowStaging});
 const approvedAccess=createPhoneLicenseLookup({db:serverDb,clock});
 const gate=createSupabasePhoneAccountGate({authClient:serverAuthClient,profileDb:serverDb,approvedAccess});
 return {
  register:(phone,password)=>native.register(phone,password),
  async login(phone,password){
   const result=await native.login(phone,password);
   const permission=await gate(result.session.access_token);
   if(!permission.allowed)return {allowed:false,reason:permission.reason,session:null};
   if(permission.userId!==result.userId)return {allowed:false,reason:'IDENTITY_MISMATCH',session:null};
   return {allowed:true,reason:'APPROVED',session:result.session,userId:result.userId};
  }
 };
}
