import test from 'node:test';
import assert from 'node:assert/strict';
import {createPendingOrder,confirmOrderPayment,listOrders,cancelPendingOrder} from './admin-api.mjs';
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

test('cancel pending only uses commercial RPC',async()=>{
 const calls=[];const client={rpc:async(name)=>{calls.push(name);return {data:true,error:null};}};
 assert.deepEqual(await cancelPendingOrder(client,customerUserId),{cancelled:true,licenseChanged:false});
 assert.deepEqual(calls,['ott_admin_cancel_commercial_order']);
});
test('cannot cancel a non-pending order',async()=>{
 const client={rpc:async()=>({data:false,error:null})};
 await assert.rejects(cancelPendingOrder(client,customerUserId),/not pending/);
});

test('RPC permission error is surfaced without retrying or changing licenses',async()=>{
 const calls=[];
 const client={rpc:async(name)=>{calls.push(name);return {data:null,error:{message:'Admin permission required'}};}};
 await assert.rejects(createPendingOrder(client,{customerUserId,durationMonths:1}),/Admin permission required/);
 assert.deepEqual(calls,['ott_admin_create_commercial_order']);
});
test('duplicate payment confirmation is rejected',async()=>{
 const client={rpc:async()=>({data:false,error:null})};
 await assert.rejects(confirmOrderPayment(client,customerUserId),/already confirmed/);
});
test('invalid order UUID cannot call RPC',async()=>{
 let called=false;
 const client={rpc:async()=>{called=true;return {data:true,error:null};}};
 await assert.rejects(confirmOrderPayment(client,'invalid'),/Invalid order UUID/);
 await assert.rejects(cancelPendingOrder(client,'invalid'),/Invalid order UUID/);
 assert.equal(called,false);
});
test('list limit must be within safe range',async()=>{
 const client={rpc:async()=>{throw Error('must not call')}};
 await assert.rejects(listOrders(client,101),RangeError);
 await assert.rejects(listOrders(client,0),RangeError);
});

test('reject blank or oversized payment reference before RPC',async()=>{
 let calls=0;const client={rpc:async()=>{calls++;return {data:null,error:null};}};
 for(const paymentReference of ['   ','x'.repeat(121)]) {
  await assert.rejects(createPendingOrder(client,{customerUserId,durationMonths:1,paymentReference}),RangeError);
 }
 assert.equal(calls,0);
});

test('reject oversized notes and invalid customer before RPC',async()=>{
 let calls=0;const client={rpc:async()=>{calls++;return {data:null,error:null};}};
 await assert.rejects(createPendingOrder(client,{customerUserId,durationMonths:1,notes:'x'.repeat(1001)}),RangeError);
 await assert.rejects(createPendingOrder(client,{customerUserId:'invalid',durationMonths:1}),TypeError);
 assert.equal(calls,0);
});

test('malformed RPC responses cannot appear as successful orders',async()=>{
 const client={rpc:async()=>({data:null,error:null})};
 await assert.rejects(createPendingOrder(client,{customerUserId,durationMonths:1}),/Invalid order ID/);
 await assert.rejects(listOrders(client),/Invalid order list/);
});

test('reject non-boolean confirmation and cancellation RPC responses',async()=>{
 const client={rpc:async()=>({data:'true',error:null})};
 await assert.rejects(confirmOrderPayment(client,customerUserId),/not pending/);
 await assert.rejects(cancelPendingOrder(client,customerUserId),/not pending/);
});
test('reject malformed RPC list payload objects',async()=>{
 const client={rpc:async()=>({data:{orders:[]},error:null})};
 await assert.rejects(listOrders(client),/Invalid order list/);
});

test('invalid list limits never reach Supabase RPC',async()=>{
 let calls=0;const client={rpc:async()=>{calls++;return {data:[],error:null};}};
 for(const limit of [null,NaN,Infinity,1.5,-1,'50']) await assert.rejects(listOrders(client,limit),RangeError);
 assert.equal(calls,0);
});
test('missing authenticated client is rejected before operations',async()=>{
 await assert.rejects(createPendingOrder(null,{customerUserId,durationMonths:1}),TypeError);
 await assert.rejects(listOrders(null),TypeError);
 await assert.rejects(confirmOrderPayment(null,customerUserId),TypeError);
 await assert.rejects(cancelPendingOrder(null,customerUserId),TypeError);
});

test('failed create RPC cannot return a pending order ID',async()=>{
 const client={rpc:async()=>({data:'22222222-2222-4222-8222-222222222222',error:{message:'Payment reference already used'}})};
 await assert.rejects(createPendingOrder(client,{customerUserId,durationMonths:1}),/Payment reference already used/);
});
test('failed confirmation and cancellation RPCs never report success',async()=>{
 const client={rpc:async()=>({data:true,error:{message:'Admin permission required'}})};
 await assert.rejects(confirmOrderPayment(client,customerUserId),/Admin permission required/);
 await assert.rejects(cancelPendingOrder(client,customerUserId),/Admin permission required/);
});
