import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductionLicenseRpcGate} from './production-license-rpc-gate.mjs';
const id='11111111-1111-4111-8111-111111111111';
function gate({userId=id,license={success:true,active:true,is_admin:false},rpcError=null,authError=null}={}){
 let calls=0;
 const check=createProductionLicenseRpcGate({userClientFactory:async token=>{
  assert.equal(token,'test-token');
  return {auth:{getUser:async()=>({data:{user:{id:userId}},error:authError})},rpc:async name=>{
   calls++;assert.equal(name,'check_email_license');return {data:license,error:rpcError};
  }};
 }});
 return {check,calls:()=>calls};
}
test('allows active license for verified same user',async()=>{
 const g=gate();const result=await g.check({accessToken:'test-token',expectedUserId:id});
 assert.deepEqual(result,{allowed:true,reason:'APPROVED',isAdmin:false});
 assert.equal(g.calls(),1);
});
test('blocks identity mismatch before RPC',async()=>{
 const g=gate({userId:'22222222-2222-4222-8222-222222222222'});
 assert.equal((await g.check({accessToken:'test-token',expectedUserId:id})).allowed,false);
 assert.equal(g.calls(),0);
});
test('blocks inactive, malformed and failed license RPC',async()=>{
 for(const options of [{license:{success:true,active:false}},{license:{success:false,active:true}},{license:null},{rpcError:new Error('offline')}]){
  const g=gate(options);assert.equal((await g.check({accessToken:'test-token',expectedUserId:id})).allowed,false);
 }
});
test('blocks unauthenticated requests',async()=>{
 const g=gate();assert.equal((await g.check({accessToken:'',expectedUserId:id})).allowed,false);assert.equal(g.calls(),0);
});

test('admin license is denied by the gate itself',async()=>{
 const g=gate({license:{success:true,active:true,is_admin:true}});
 const result=await g.check({accessToken:'test-token',expectedUserId:id});
 assert.deepEqual(result,{allowed:false,reason:'ADMIN_PHONE_LOGIN_DISABLED'});
});
