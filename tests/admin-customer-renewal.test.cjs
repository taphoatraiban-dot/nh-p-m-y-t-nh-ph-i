'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRenewedExpiry } = require('../src/admin-customer-renewal.cjs');

const now = new Date('2026-10-26T03:00:00Z'); // 10:00 Asia/Ho_Chi_Minh

test('expired license starts new 30 days from the actual renewal time', () => {
  assert.equal(calculateRenewedExpiry({ expiresAt: '2026-10-20T03:00:00Z', days: 30, now }), '2026-11-25T03:00:00.000Z');
});

test('active license adds time after the existing expiry, preserving remaining time', () => {
  assert.equal(calculateRenewedExpiry({ expiresAt: '2026-11-15T03:00:00Z', days: 30, now }), '2026-12-15T03:00:00.000Z');
});

test('license expiring exactly now starts from now, never loses days', () => {
  assert.equal(calculateRenewedExpiry({ expiresAt: '2026-10-26T03:00:00Z', days: 1, now }), '2026-10-27T03:00:00.000Z');
});

test('missing existing expiry starts from now but invalid timestamps fail closed', () => {
  assert.equal(calculateRenewedExpiry({ expiresAt: null, days: 7, now }), '2026-11-02T03:00:00.000Z');
  for (const expiresAt of ['bad', '2026-10-20', '2026-13-20T03:00:00Z']) {
    assert.throws(() => calculateRenewedExpiry({ expiresAt, days: 7, now }));
  }
});

test('renewal does not mutate existing state or interpret paused license as activation', () => {
  const license = Object.freeze({ expiresAt: '2026-10-20T03:00:00Z', paused: true });
  const next = calculateRenewedExpiry({ expiresAt: license.expiresAt, days: 10, now });
  assert.equal(next, '2026-11-05T03:00:00.000Z');
  assert.equal(license.paused, true);
  assert.equal(license.expiresAt, '2026-10-20T03:00:00Z');
});

test('validates duration and clock boundary', () => {
  for (const days of [0, -1, 1.5, 366, NaN, Infinity]) {
    assert.throws(() => calculateRenewedExpiry({ expiresAt: null, days, now }), RangeError);
  }
  assert.throws(() => calculateRenewedExpiry({ expiresAt: null, days: 1, now: new Date('invalid') }), TypeError);
});
