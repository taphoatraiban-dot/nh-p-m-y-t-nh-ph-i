// Local integration contract. Does NOT mount admin endpoints or use production credentials.
import {createAdminApiHandler} from './admin-api-handler.mjs';
import {createSupabaseAdminServerAdapter} from './supabase-admin-server-adapter.mjs';
export function createLocalAdminIntegration({store,authClient,adminDb,verifyCsrf}={}){
 if(!store||typeof verifyCsrf!=='function')throw new TypeError('ADMIN_INTEGRATION_SECURITY_REQUIRED');
 const verifyAdmin=createSupabaseAdminServerAdapter({authClient,adminDb});
 return createAdminApiHandler({store,verifyAdmin,verifyCsrf});
}
