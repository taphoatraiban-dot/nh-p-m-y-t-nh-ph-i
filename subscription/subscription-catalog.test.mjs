import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteSubscription, calculateRenewalExpiry, addCalendarMonths, MAX_CONCURRENT_PHONES, TRIAL_HOURS } from './subscription-catalog.mjs';

test('all eight prices match approved catalog', () => {
  const web = [799000, 2290000, 4390000, 7990000];
  const print = [1299000, 3690000, 6990000, 12990000];
  [1,3,6,12].forEach((months,i) => {
    assert.equal(quoteSubscription('WEB',months).priceVnd,web[i]);
    assert.equal(quoteSubscription('WEB_PRINT',months).priceVnd,print[i]);
    assert.equal(quoteSubscription('WEB_PRINT',months).canPurchase,false);
  });
});
test('rejects invalid plan and duration', () => {
  assert.throws(()=>quoteSubscription('LIFETIME',1),RangeError);
  assert.throws(()=>quoteSubscription('WEB',2),RangeError);
});
test('early renewal extends remaining term',()=>{
  assert.equal(calculateRenewalExpiry({now:'2026-11-01T00:00:00.000Z',currentExpiry:'2026-12-01T00:00:00.000Z',months:3}),'2027-03-01T00:00:00.000Z');
});
test('expired renewal starts now',()=>{
  assert.equal(calculateRenewalExpiry({now:'2026-11-01T00:00:00.000Z',currentExpiry:'2026-10-01T00:00:00.000Z',months:1}),'2026-12-01T00:00:00.000Z');
});
test('calendar month clamps month end',()=>{
  assert.equal(addCalendarMonths('2026-01-31T10:00:00.000Z',1),'2026-02-28T10:00:00.000Z');
});
test('one phone and 48 hour trial policy',()=>{
  assert.equal(MAX_CONCURRENT_PHONES,1);
  assert.equal(TRIAL_HOURS,48);
});
