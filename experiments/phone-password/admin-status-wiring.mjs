// SERVER ONLY. Wires real Supabase client interfaces into minimal read-only status.
// No route mounting or service credentials included.
import {createSupabaseAdminServerAdapter} from './supabase-admin-server-adapter.mjs';
import {createAdminSessionStatus} from './admin-session-status.mjs';
export function createAdminStatusWiring({authClient,adminDb}={}){
 const verifyAdmin=createSupabaseAdminServerAdapter({authClient,adminDb});
 return createAdminSessionStatus({verifyAdmin});
}
