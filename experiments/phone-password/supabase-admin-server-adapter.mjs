// Experimental server-only adapter. NOT mounted. Never send service-role key to a browser.
// The supplied authClient must verify the JWT against Supabase Auth using getUser(token).
// The supplied adminDb must query public.admin_users with trusted server credentials.
// Caller must still enforce CSRF, origin restrictions and rate limits.
import {createSupabaseAdminVerifier} from './supabase-admin-verifier.mjs';
export function createSupabaseAdminServerAdapter({authClient,adminDb}={}){
 if(typeof authClient?.auth?.getUser!=='function'||typeof adminDb?.from!=='function')
  throw new TypeError('SUPABASE_SERVER_CLIENTS_REQUIRED');
 return createSupabaseAdminVerifier({
  getUser:async token=>{
   const {data,error}=await authClient.auth.getUser(token);
   if(error||!data?.user)return null;
   return data.user;
  },
  isAdmin:async id=>{
   const {data,error}=await adminDb.from('admin_users').select('user_id').eq('user_id',id).limit(1);
   if(error)return false;
   return Array.isArray(data)&&data.length===1&&data[0].user_id===id;
  }
 });
}
