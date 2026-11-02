import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneAccessStatus } from './phone-access-status.mjs';

const identity = {accountId:'test-account',scope:'phone-auth-experiment-only'};
const auth = {authenticate:async()=>identity};
test('approved experimental account is allowed',async()=>{
 const result=await phoneAccessStatus({auth,token:'local',findGrant:async()=>({account_id:'test-account',status:'approved',expires_at:null})});
 assert.equal(result.allowed,true);
});
test('pending and missing sessions are denied',async()=>{
 const pending=await phoneAccessStatus({auth,token:'local',findGrant:async()=>null});
 assert.equal(pending.allowed,false);
 const missing=await phoneAccessStatus({auth:{authenticate:async()=>null},token:null,findGrant:async()=>null});
 assert.equal(missing.reason,'UNAUTHENTICATED');
});
test('database errors fail closed',async()=>{
 const result=await phoneAccessStatus({auth,token:'local',findGrant:async()=>{throw Error('offline')}});
 assert.deepEqual(result,{allowed:false,reason:'UNAVAILABLE'});
});
