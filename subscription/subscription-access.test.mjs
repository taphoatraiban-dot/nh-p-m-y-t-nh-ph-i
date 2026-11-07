import test from 'node:test';
import assert from 'node:assert/strict';
import {decideSubscriptionAccess,decidePhoneTransfer} from './subscription-access.mjs';
const now='2026-11-01T12:00:00Z';
test('admin unaffected by expiry',()=>assert.equal(decideSubscriptionAccess({now,isAdmin:true}).reason,'admin'));
test('legacy lifetime and valid licenses preserved',()=>{
 assert.equal(decideSubscriptionAccess({now,legacyLifetime:true}).allowed,true);
 assert.equal(decideSubscriptionAccess({now,legacyValid:true}).allowed,true);
});
test('paid subscription checks expiry and status',()=>{
 assert.equal(decideSubscriptionAccess({now,subscription:{status:'active',expires_at:'2026-11-02T00:00:00Z',plan_code:'WEB'}}).reason,'paid');
 assert.equal(decideSubscriptionAccess({now,subscription:{status:'paused',expires_at:'2026-11-02T00:00:00Z'}}).allowed,false);
 assert.equal(decideSubscriptionAccess({now,subscription:{status:'active',expires_at:now}}).allowed,false);
});
test('48h trial only and future starts denied',()=>{
 assert.equal(decideSubscriptionAccess({now,trialStartedAt:'2026-10-30T12:00:01Z'}).reason,'trial');
 assert.equal(decideSubscriptionAccess({now,trialStartedAt:'2026-10-30T12:00:00Z'}).allowed,false);
 assert.equal(decideSubscriptionAccess({now,trialStartedAt:'2026-11-02T00:00:00Z'}).allowed,false);
});
test('phone transfer at most twice in rolling 30 days',()=>{
 assert.equal(decidePhoneTransfer({now,transferTimes:[]}).allowed,true);
 assert.equal(decidePhoneTransfer({now,transferTimes:['2026-10-31T00:00:00Z','2026-10-30T00:00:00Z']}).reason,'transfer_limit');
 assert.equal(decidePhoneTransfer({now,transferTimes:['2026-09-01T00:00:00Z','2026-10-30T00:00:00Z']}).allowed,true);
});
test('same phone and admin recovery do not consume transfers',()=>{
 const transferTimes=['2026-10-31T00:00:00Z','2026-10-30T00:00:00Z'];
 assert.equal(decidePhoneTransfer({now,transferTimes,samePhone:true}).allowed,true);
 assert.equal(decidePhoneTransfer({now,transferTimes,adminOverride:true}).allowed,true);
});
