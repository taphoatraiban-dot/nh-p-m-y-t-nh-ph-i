/** Admin RPC adapter. Uses an already-authenticated Supabase client provided by the host app.
 * Never uses service_role or modifies legacy licenses/devices.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ensureClient(client) {
 if(!client || typeof client.rpc!=='function') throw new TypeError('Authenticated Supabase client required');
 return client;
}
function resultOrThrow(result) {
 if(result?.error) throw new Error(result.error.message || 'RPC failed');
 return result?.data;
}
export async function createPendingOrder(client,{customerUserId,planCode='WEB',durationMonths,paymentReference=null,notes=null}) {
 ensureClient(client);
 if(!UUID.test(customerUserId)) throw new TypeError('Invalid customer UUID');
 if(planCode!=='WEB') throw new RangeError('WEB_PRINT is not available');
 if(![1,3,6,12].includes(durationMonths)) throw new RangeError('Invalid duration');
 const result=await client.rpc('ott_admin_create_commercial_order',{
  p_customer_user_id:customerUserId,p_plan_code:planCode,
  p_duration_months:durationMonths,p_payment_reference:paymentReference,p_notes:notes
 });
 return resultOrThrow(result);
}
export async function confirmOrderPayment(client,orderId) {
 ensureClient(client);
 if(!UUID.test(orderId)) throw new TypeError('Invalid order UUID');
 const confirmed=resultOrThrow(await client.rpc('ott_admin_confirm_commercial_order',{p_order_id:orderId}));
 if(confirmed!==true) throw new Error('Order not pending or already confirmed');
 return {confirmed:true,licenseRenewed:false};
}
export async function listOrders(client,limit=50) {
 ensureClient(client);
 if(!Number.isInteger(limit)||limit<1||limit>100) throw new RangeError('Invalid limit');
 return resultOrThrow(await client.rpc('ott_admin_list_commercial_orders',{p_limit:limit}));
}
