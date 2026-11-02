import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalPhoneRateLimiter} from './local-phone-rate-limit.mjs';
test('limits to five attempts in one window',()=>{
 let now=1000;const limit=createLocalPhoneRateLimiter({clock:()=>now,windowMs:60000,maxAttempts:5});
 for(let i=0;i<5;i++)assert.equal(limit('ip:phone').allowed,true);
 const blocked=limit('ip:phone');assert.equal(blocked.allowed,false);assert.equal(blocked.retryAfterMs,60000);
 assert.equal(limit('other').allowed,true);
 now+=60001;assert.equal(limit('ip:phone').allowed,true);
});
test('rejects invalid limiter parameters and keys',()=>{
 assert.throws(()=>createLocalPhoneRateLimiter({maxAttempts:0}));
 const limit=createLocalPhoneRateLimiter();
 assert.throws(()=>limit(''));
});
