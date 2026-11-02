// Read-only compatibility check against the same RPC used by the production web app.
// Caller must supply a Supabase client scoped to the freshly authenticated user,
// not a service-role client. No access token or user id is returned to the browser.
export function createProductionLicenseRpcGate({userClientFactory}={}){
 if(typeof userClientFactory!=='function')throw new TypeError('USER_CLIENT_FACTORY_REQUIRED');
 return async function check({accessToken,expectedUserId}={}){
  if(typeof accessToken!=='string'||!accessToken||typeof expectedUserId!=='string'||!expectedUserId)
   return {allowed:false,reason:'UNAUTHENTICATED'};
  try{
   const client=await userClientFactory(accessToken);
   if(typeof client?.auth?.getUser!=='function'||typeof client?.rpc!=='function')return {allowed:false,reason:'UNAVAILABLE'};
   const {data:identity,error:identityError}=await client.auth.getUser(accessToken);
   if(identityError||identity?.user?.id!==expectedUserId)return {allowed:false,reason:'IDENTITY_MISMATCH'};
   const {data,error}=await client.rpc('check_email_license');
   if(error||data?.success!==true||data?.active!==true)return {allowed:false,reason:'LICENSE_NOT_APPROVED'};
   if(data.is_admin===true)return {allowed:false,reason:'ADMIN_PHONE_LOGIN_DISABLED'};
   return {allowed:true,reason:'APPROVED',isAdmin:data.is_admin===true};
  }catch{return {allowed:false,reason:'UNAVAILABLE'};}
 };
}
