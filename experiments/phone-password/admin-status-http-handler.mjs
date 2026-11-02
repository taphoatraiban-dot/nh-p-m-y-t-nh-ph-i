// Read-only, server-side admin status endpoint. Not mounted in production.
import {createAdminStatusWiring} from './admin-status-wiring.mjs';
export function createAdminStatusHttpHandler({authClient,adminDb}={}){
 const status=createAdminStatusWiring({authClient,adminDb});
 return async function handle(req){
  if(req?.method!=='GET'||req?.url!=='/admin/phone/status')
   return {status:404,body:{error:'NOT_FOUND'}};
  return status(req);
 };
}
