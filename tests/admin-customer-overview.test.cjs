'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveState, normalizeRows, filterRows } = require('../src/admin-customer-overview.cjs');

const now = new Date('2026-10-26T00:00:00Z');
const base = { account_kind: 'registered', user_id: 'uuid-1', email: 'a@example.com', license_active: true, expires_at: '2026-11-10T00:00:00Z', device_count: 2, last_seen: null };

test('states distinguish valid, near expiry, expired and paused', () => {
  assert.equal(deriveState(base, now), 'active');
  assert.equal(deriveState({ ...base, expires_at: '2026-10-28T00:00:00Z' }, now), 'soon');
  assert.equal(deriveState({ ...base, expires_at: '2026-10-25T00:00:00Z' }, now), 'expired');
  assert.equal(deriveState({ ...base, license_active: false }, now), 'paused');
});
test('pending reservation is not represented as a registered account', () => {
  assert.equal(deriveState({ ...base, account_kind: 'pending', user_id: null }, now), 'pending');
});
test('adapter whitelists fields and does not propagate secrets', () => {
  const [row] = normalizeRows([{ ...base, revision: 3, api_key: 'DO_NOT_PROPAGATE', pin: '1234' }], now);
  assert.equal(row.email, 'a@example.com');
  assert.equal(row.deviceCount, 2);
  assert.equal(row.revision, 3);
  assert.equal(JSON.stringify(row).includes('DO_NOT_PROPAGATE'), false);
  assert.equal(JSON.stringify(row).includes('1234'), false);
});
test('registered revision is validated and pending rows do not allow command revisions', () => {
  assert.throws(() => normalizeRows([{ ...base, revision: -1 }], now), /revision/);
  assert.throws(() => normalizeRows([{ ...base, revision: 'invalid' }], now), /revision/);
  assert.equal(normalizeRows([{ ...base, account_kind: 'pending', revision: null }], now)[0].revision, null);
});
test('filters by email, id and status', () => {
  const rows = normalizeRows([base, { ...base, user_id: null, email: 'pending@example.com', account_kind: 'pending' }], now);
  assert.equal(filterRows(rows, { search: 'pending' }).length, 1);
  assert.equal(filterRows(rows, { status: 'active' }).length, 1);
  assert.equal(filterRows(rows, { status: 'pending' }).length, 1);
});
test('rejects malformed source rows', () => {
  assert.throws(() => normalizeRows({}), /array/);
  assert.throws(() => normalizeRows([{ account_kind: 'unknown' }]), /kind/);
  assert.throws(() => normalizeRows([{ account_kind: 'registered' }]), /email/);
});
