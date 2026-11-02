// Server-side read-only session status. Do not expose tokens, email or user IDs.
// Supply a verifier backed by Supabase Auth getUser and trusted admin_users lookup.
export function createAdminSessionStatus({verifyAdmin}={}){
 if(typeof verifyAdmin!=='function')throw new TypeError('VERIFIED_ADMIN_REQUIRED');
 return async function status(request){
  const header=request?.headers?.authorization;
  if(typeof header!=='string'||!/^Bearer [^\s]+$/.test(header))return {status:401,body:{authenticated:false,admin:false}};
  try{
   const result=await verifyAdmin(request);
   // A verified admin implies authenticated; other responses are intentionally generic.
   return {status:200,body:{authenticated:Boolean(result),admin:Boolean(result)}};
  }catch{
   return {status:503,body:{authenticated:false,admin:false}};
  }
 };
}
