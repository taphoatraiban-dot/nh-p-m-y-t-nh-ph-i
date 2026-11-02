// Read-only, fail-closed authorization after a real Supabase Auth login.
// Do not infer admin access from profiles.role or user_metadata.
export function createSupabasePhoneAccountGate({authClient,profileDb,approvedAccess}={}){
 if(typeof authClient?.auth?.getUser!=='function'||typeof profileDb?.from!=='function'||typeof approvedAccess!=='function')
  throw new TypeError('SERVER_DEPENDENCIES_REQUIRED');
 return async function check(accessToken){
  if(typeof accessToken!=='string'||!accessToken.trim())return {allowed:false,reason:'UNAUTHENTICATED'};
  try{
   const {data:auth,error:authError}=await authClient.auth.getUser(accessToken);
   if(authError||!auth?.user?.id)return {allowed:false,reason:'UNAUTHENTICATED'};
   const userId=auth.user.id;
   const {data:profiles,error:profileError}=await profileDb.from('profiles').select('id').eq('id',userId).limit(1);
   if(profileError||!Array.isArray(profiles)||profiles.length!==1||profiles[0].id!==userId)
    return {allowed:false,reason:'PROFILE_REQUIRED'};
   const approved=await approvedAccess(userId);
   if(approved!==true)return {allowed:false,reason:'ADMIN_APPROVAL_REQUIRED'};
   return {allowed:true,reason:'APPROVED',userId};
  }catch{return {allowed:false,reason:'UNAVAILABLE'};}
 };
}
