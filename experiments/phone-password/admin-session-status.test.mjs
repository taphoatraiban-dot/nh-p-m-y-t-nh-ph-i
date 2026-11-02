import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminSessionStatus} from './admin-session-status.mjs';
test('rejects missing or malformed bearer without verifier call',async()=>{
 let calls=0;const handler=createAdminSessionStatus({verifyAdmin:async()=>{calls++;return true}});
 for(const headers of [{},{authorization:'Basic secret'},{authorization:'Bearer x y'}]){
  const r=await handler({headers});assert.equal(r.status,401);assert.deepEqual(r.body,{authenticated:false,admin:false});
 }assert.equal(calls,0);
});
test('returns minimal true result for verified admin',async()=>{
 const h=createAdminSessionStatus({verifyAdmin:async()=>({id:'private',email:'hidden'})});
 const r=await h({headers:{authorization:'Bearer valid-token'}});
 assert.deepEqual(r,{status:200,body:{authenticated:true,admin:true}});
 assert.equal(JSON.stringify(r).includes('private'),false);
});
test('denies non-admin and fails closed on errors',async()=>{
 const req={headers:{authorization:'Bearer valid-token'}};
 assert.deepEqual(await createAdminSessionStatus({verifyAdmin:async()=>null})(req),{status:200,body:{authenticated:false,admin:false}});
 assert.equal((await createAdminSessionStatus({verifyAdmin:async()=>{throw Error('secret')}})(req)).status,503);
});
