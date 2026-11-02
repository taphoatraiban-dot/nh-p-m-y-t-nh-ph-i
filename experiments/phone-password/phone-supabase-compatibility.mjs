// Explicitly prevent local phone sessions from being mistaken for Supabase Auth sessions.
// Existing Cuncun RLS requires a Supabase-issued user access token.
export function classifyPhoneSessionForCuncun(identity) {
 if (!identity || identity.scope !== 'phone-auth-experiment-only')
   return {compatible:false,reason:'INVALID_IDENTITY'};
 return {compatible:false,reason:'SUPABASE_AUTH_SESSION_REQUIRED'};
}
export async function requireSupabaseUser({authClient,accessToken}={}) {
 if (!authClient?.auth || typeof authClient.auth.getUser!=='function' ||
     typeof accessToken!=='string' || !accessToken.trim())
   return {authenticated:false,userId:null};
 try {
  const {data,error}=await authClient.auth.getUser(accessToken);
  if(error || !data?.user?.id) return {authenticated:false,userId:null};
  return {authenticated:true,userId:data.user.id};
 } catch {return {authenticated:false,userId:null};}
}
