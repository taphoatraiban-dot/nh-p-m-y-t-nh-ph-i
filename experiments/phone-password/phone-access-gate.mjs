// Local experimental access gate. NOT a Supabase Auth session or production RLS grant.
// Never use this result to authorize existing Cuncun data.
import {evaluatePhoneAccess} from './access-policy.mjs';
export function createPhoneAccessGate({authService,findGrant,now=()=>new Date()}={}){
 if(typeof authService?.authenticate!=='function'||typeof findGrant!=='function')throw new TypeError('PHONE_ACCESS_DEPENDENCIES_REQUIRED');
 return async function check(token){
  try{
   const identity=await authService.authenticate(token);
   if(!identity||identity.scope!=='phone-auth-experiment-only'||!identity.accountId)
    return {allowed:false,reason:'UNAUTHENTICATED'};
   const grant=await findGrant(identity.accountId);
   return evaluatePhoneAccess({identity,grant,now:now()});
  }catch{return {allowed:false,reason:'UNAVAILABLE'};}
 };
}
