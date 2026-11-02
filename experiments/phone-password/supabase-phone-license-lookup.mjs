// Read-only server-side lookup using existing Cuncun licenses.
// Never use phone text alone for authorization. Match verified Supabase UUID.
export function createPhoneLicenseLookup({db,clock=()=>new Date()}={}){
 if(typeof db?.from!=='function')throw new TypeError('DATABASE_REQUIRED');
 return async function approvedAccess(userId){
  if(typeof userId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId))return false;
  try{
   const {data,error}=await db.from('licenses').select('user_id,active,expires_at').eq('user_id',userId).limit(1);
   if(error||!Array.isArray(data)||data.length!==1)return false;
   const license=data[0];
   if(license.user_id!==userId||license.active!==true)return false;
   if(license.expires_at!==null&&license.expires_at!==undefined){
    const expiry=new Date(license.expires_at).getTime();
    if(!Number.isFinite(expiry)||expiry<=clock().getTime())return false;
   }
   return true;
  }catch{return false;}
 };
}
