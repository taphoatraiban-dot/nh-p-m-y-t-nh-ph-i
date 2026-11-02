import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePhoneAccess } from './access-policy.mjs';
const now = new Date('2026-11-02T00:00:00Z');
const identity = { accountId:'account-1', scope:'phone-auth-experiment-only' };
const approved = {account_id:'account-1',status:'approved',expires_at:'2026-12-02T00:00:00Z',revoked_at:null};
test('rejects missing or wrong identity scope',()=>{
 assert.equal(evaluatePhoneAccess({grant:approved,now}).allowed,false);
 assert.equal(evaluatePhoneAccess({identity:{...identity,scope:'supabase'},grant:approved,now}).allowed,false);
});
test('rejects missing, pending, mismatched, revoked or expired grants',()=>{
 for(const grant of [null,{...approved,status:'pending'},{...approved,account_id:'another'},{...approved,revoked_at:'2026-11-01T00:00:00Z'},{...approved,expires_at:'2026-11-02T00:00:00Z'}]){
  assert.equal(evaluatePhoneAccess({identity,grant,now}).allowed,false);
 }
});
test('approval only permits experimental scope',()=>{
 assert.deepEqual(evaluatePhoneAccess({identity,grant:approved,now}),{allowed:true,reason:'APPROVED_EXPERIMENT_ONLY'});
});
