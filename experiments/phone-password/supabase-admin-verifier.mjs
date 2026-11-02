// LOCAL experimental adapter, not mounted. No service keys or admin claims from the browser.
// getUser(token): trusted Supabase Auth server-side validation.
// isAdmin(userId): trusted server-side query of public.admin_users with RLS-safe credentials.
// Never infer admin membership from user_metadata, phone_session, or client-supplied role.
export function createSupabaseAdminVerifier({getUser,isAdmin}={}){
 if(typeof getUser!=='function'||typeof isAdmin!=='function')throw new TypeError('TRUSTED_SUPABASE_DEPENDENCIES_REQUIRED');
 return async function verifyAdmin(req){
  const authorization=req?.headers?.authorization;
  if(typeof authorization!=='string'||!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization))return null;
  const token=authorization.slice(7);
  if(token.length<20||token.length>8192)return null;
  try{
   const user=await getUser(token);
   if(!user||typeof user.id!=='string'||!/^[0-9a-f-]{36}$/i.test(user.id))return null;
   const member=await isAdmin(user.id);
   if(member!==true)return null;
   return {id:user.id,role:'admin',authenticated:true,source:'supabase-auth-server'};
  }catch{return null;}
 };
}
