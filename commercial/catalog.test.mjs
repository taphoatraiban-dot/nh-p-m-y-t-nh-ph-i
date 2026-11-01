import test from 'node:test';
import assert from 'node:assert/strict';
import {quote,renewalQuote,addMonthsClamped} from './catalog.mjs';
test('all approved prices',()=>{
 assert.deepEqual([1,3,6,12].map(m=>quote('WEB',m).amountVnd),[799000,2290000,4390000,7990000]);
 assert.deepEqual([1,3,6,12].map(m=>quote('WEB_PRINT',m).amountVnd),[1299000,3690000,6990000,12990000]);
});
test('print not available',()=>assert.equal(quote('WEB_PRINT',1).canSell,false));
test('early renewal adds to current expiry',()=>assert.equal(renewalQuote({now:'2026-11-01T00:00:00Z',expiresAt:'2026-12-01T00:00:00Z',plan:'WEB',months:3}).proposedExpiresAt,'2027-03-01T00:00:00.000Z'));
test('expired renewal starts today',()=>assert.equal(renewalQuote({now:'2026-11-01T00:00:00Z',expiresAt:'2026-10-01T00:00:00Z',plan:'WEB',months:1}).proposedExpiresAt,'2026-12-01T00:00:00.000Z'));
test('month-end clamp',()=>assert.equal(addMonthsClamped('2026-01-31T00:00:00Z',1),'2026-02-28T00:00:00.000Z'));
test('reject invalid term',()=>assert.throws(()=>quote('WEB',2),RangeError));

test('leap year February is clamped correctly',()=>assert.equal(addMonthsClamped('2028-01-31T00:00:00Z',1),'2028-02-29T00:00:00.000Z'));
test('year boundary month clamp',()=>assert.equal(addMonthsClamped('2026-12-31T00:00:00Z',2),'2027-02-28T00:00:00.000Z'));
