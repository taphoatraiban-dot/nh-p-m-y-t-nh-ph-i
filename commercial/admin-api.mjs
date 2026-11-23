/** Admin RPC adapter. Uses an already-authenticated Supabase client provided by the host app.
 * Never uses service_role or modifies legacy licenses/devices.
 */
import {quote} from './catalog.mjs';
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
 if(paymentReference!==null && (typeof paymentReference!=='string'||!paymentReference.trim()||paymentReference.length>120)) throw new RangeError('Invalid payment reference');
 if(notes!==null && (typeof notes!=='string'||notes.length>1000)) throw new RangeError('Invalid notes');
 const result=await client.rpc('ott_admin_create_commercial_order',{
  p_customer_user_id:customerUserId,p_plan_code:planCode,
  p_duration_months:durationMonths,p_payment_reference:paymentReference,p_notes:notes
 });
 const orderId=resultOrThrow(result);
 if(typeof orderId!=='string'||!UUID.test(orderId)) throw new Error('Invalid order ID returned by server');
 return orderId;
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
 const orders=resultOrThrow(await client.rpc('ott_admin_list_commercial_orders',{p_limit:limit}));
 if(!Array.isArray(orders)) throw new Error('Invalid order list returned by server');
 if(orders.length>limit) throw new Error('Order list exceeds requested limit');
 const seen=new Set();
 for(const order of orders) {
  if(!order || typeof order!=='object' || Array.isArray(order) || !UUID.test(order.id) || !UUID.test(order.customer_user_id) || !['pending','confirmed','cancelled'].includes(order.status) || order.plan_code!=='WEB' || ![1,3,6,12].includes(order.duration_months) || !Number.isSafeInteger(order.amount_vnd) || order.amount_vnd!==quote('WEB',order.duration_months).amountVnd) throw new Error('Invalid commercial order returned by server');
  if(seen.has(order.id)) throw new Error('Duplicate commercial order returned by server');
  seen.add(order.id);
 }
 return orders;
}

/** Cancel only an unpaid commercial order; never touches entitlements. */
export async function cancelPendingOrder(client,orderId) {
 ensureClient(client);
 if(!UUID.test(orderId)) throw new TypeError('Invalid order UUID');
 const cancelled=resultOrThrow(await client.rpc('ott_admin_cancel_commercial_order',{p_order_id:orderId}));
 if(cancelled!==true) throw new Error('Order not pending or already processed');
 return {cancelled:true,licenseChanged:false};
}
