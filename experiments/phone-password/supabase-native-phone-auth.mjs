// Native Supabase Auth creates a real Supabase session; staging only until reviewed.
// Requires phone provider enabled and a deliberate no-SMS verification policy.
// Does not assign admin or subscription privileges.
import {normalizeVietnamesePhone,validatePassword} from './phone-password-core.mjs';
export function createNativePhoneAuth({supabase,allowStaging=false}={}){
 if(!allowStaging||!supabase?.auth?.signUp||!supabase?.auth?.signInWithPassword)
  throw new Error('STAGING_ONLY_NOT_CONFIGURED');
 return {
  async register(phone,password){
   const normalized=normalizeVietnamesePhone(phone);
   validatePassword(password);
   const {data,error}=await supabase.auth.signUp({phone:normalized,password});
   if(error)throw new Error('REGISTRATION_FAILED');
   return {userId:data?.user?.id??null,sessionCreated:Boolean(data?.session),phoneVerified:false};
  },
  async login(phone,password){
   const normalized=normalizeVietnamesePhone(phone);
   const {data,error}=await supabase.auth.signInWithPassword({phone:normalized,password});
   if(error||!data?.session?.access_token||!data?.user?.id)throw new Error('INVALID_CREDENTIALS');
   return {userId:data.user.id,session:data.session};
  }
 };
}
