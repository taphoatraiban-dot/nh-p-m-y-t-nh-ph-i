import test from 'node:test';
import assert from 'node:assert/strict';
import {createPendingOrder,confirmOrderPayment,listOrders} from './admin-api.mjs';
const customerUserId='11111111-1111-4111-8111-111111111111';
test('order calls only commercial RPC',async()=>{
 const calls=[]; const client={rpc:async(name,args)=>{calls.push({name,args});return {data:'22222222-2222-4222-8222-222222222222',error:null};}};
 await createPendingOrder(client,{customerUserId,durationMonths:3});
 assert.equal(calls[0].name,'ott_admin_create_commercial_order');
 assert.equal(calls.length,1);
});
test('payment confirmation never calls license activation',async()=>{
 const calls=[];const client={rpc:async(name)=>{calls.push(name);return {data:true,error:null};}};
 assert.deepEqual(await confirmOrderPayment(client,customerUserId),{confirmed:true,licenseRenewed:false});
 assert.deepEqual(calls,['ott_admin_confirm_commercial_order']);
});
test('reject unsupported print and invalid durations before RPC',async()=>{
 const client={rpc:async()=>{throw Error('must not call')}};
 await assert.rejects(createPendingOrder(client,{customerUserId,planCode:'WEB_PRINT',durationMonths:1}),RangeError);
 await assert.rejects(createPendingOrder(client,{customerUserId,durationMonths:2}),RangeError);
});
test('list uses admin-only RPC',async()=>{
 const client={rpc:async(name,args)=>{assert.equal(name,'ott_admin_list_commercial_orders');assert.equal(args.p_limit,10);return {data:[],error:null};}};
 assert.deepEqual(await listOrders(client,10),[]);
});
