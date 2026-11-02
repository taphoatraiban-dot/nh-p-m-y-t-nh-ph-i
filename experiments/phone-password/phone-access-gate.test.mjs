import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhoneAccessGate} from './phone-access-gate.mjs';
const accountId='123e4567-e89b-42d3-a456-426614174000';
const identity={accountId,scope:'phone-auth-experiment-only'};
const make=(who,grant,now='2026-11-02T12:00:00Z')=>createPhoneAccessGate({authService:{authenticate:async()=>who},findGrant:async()=>grant,now:()=>new Date(now)});
test('rejects unauthenticated, pending, mismatched and untrusted scope',async()=>{
 assert.equal((await make(null,null)('token')).allowed,false);
 assert.equal((await make({...identity,scope:'other'},null)('token')).allowed,false);
 assert.equal((await make(identity,null)('token')).reason,'PENDING_APPROVAL');
 assert.equal((await make(identity,{account_id:'wrong',status:'approved',expires_at:null})('token')).allowed,false);
});
test('approved local grant allows, expiry and revocation deny',async()=>{
 assert.equal((await make(identity,{account_id:accountId,status:'approved',expires_at:null})('token')).allowed,true);
 assert.equal((await make(identity,{account_id:accountId,status:'approved',expires_at:'2026-11-01T00:00:00Z'})('token')).reason,'EXPIRED');
 assert.equal((await make(identity,{account_id:accountId,status:'approved',expires_at:null,revoked_at:'2026-11-01T00:00:00Z'})('token')).reason,'REVOKED');
});
test('storage failure denies access',async()=>{
 const gate=createPhoneAccessGate({authService:{authenticate:async()=>identity},findGrant:async()=>{throw Error('db down')}});
 assert.equal((await gate('token')).allowed,false);
});
