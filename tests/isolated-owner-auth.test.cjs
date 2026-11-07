'use strict';
// Entirely offline RPC simulation: never imports Supabase, opens sockets, or
// reads environment credentials. These tests do NOT validate real RLS/grants.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCustomerService, AccessDeniedError } = require('../src/admin-customer-service.cjs');

const FIXTURE = Object.freeze([
  { account_kind: 'registered', user_id: 'customer-a', email: 'a@example.invalid', license_active: true, expires_at: '2026-12-20T00:00:00Z', device_count: 1 },
  { account_kind: 'registered', user_id: 'customer-b', email: 'b@example.invalid', license_active: true, expires_at: '2026-12-20T00:00:00Z', device_count: 1 },
  { account_kind: 'registered', user_id: 'customer-c', email: 'c@example.invalid', license_active: false, expires_at: '2026-12-20T00:00:00Z', device_count: 0 },
  { account_kind: 'pending', user_id: null, email: 'pending@example.invalid', license_active: true, expires_at: '2026-12-20T00:00:00Z', device_count: 0 }
]);
const ADMINS = new Set(['owner-admin-1', 'owner-admin-2']);
const now = () => new Date('2026-10-26T00:00:00Z');

function offlineRpc(initialUser = null) {
  let user = initialUser;
  const calls = [];
  const rpc = async name => {
    calls.push({ user, name });
    if (name === 'check_email_license') {
      return { data: { success: true, is_admin: ADMINS.has(user) }, error: null };
    }
    if (name === 'admin_customer_overview') {
      if (!ADMINS.has(user)) return { data: null, error: { code: '42501', message: 'Access denied' } };
      return { data: FIXTURE, error: null };
    }
    throw new Error('Unexpected RPC: ' + name);
  };
  return { client: { rpc }, calls, selectUser(id) { user = id; } };
}

test('AUTH-01/02: distinct owner Admin 1 and Admin 2 receive the same sanitized mock rows', async () => {
  const backend = offlineRpc('owner-admin-1');
  const service = createCustomerService(backend.client, { now });
  const first = await service.list();
  backend.selectUser('owner-admin-2');
  service.invalidate();
  const second = await service.list();
  assert.deepEqual(first.rows, second.rows);
  assert.equal(first.rows.length, 4);
  assert.equal(first.rows.some(row => ADMINS.has(row.id)), false);
  assert.equal(JSON.stringify(first).includes('api_key'), false);
});

test('AUTH-03/04: customer and anonymous cannot list records', async () => {
  for (const id of ['ordinary-customer', null]) {
    const backend = offlineRpc(id);
    await assert.rejects(createCustomerService(backend.client).list(), AccessDeniedError);
    assert.deepEqual(backend.calls.map(call => call.name), ['check_email_license']);
  }
});

test('AUTH-05/06: pending customer stays separate; no admin identities or secrets are shown', async () => {
  for (const admin of ADMINS) {
    const result = await createCustomerService(offlineRpc(admin).client, { now }).list();
    assert.deepEqual(result.rows.filter(row => row.status === 'pending').map(row => row.email), ['pending@example.invalid']);
    assert.equal(result.rows.some(row => ADMINS.has(row.id)), false);
    assert.equal(result.rows.every(row => Object.keys(row).every(key => !/token|pin|secret|api_key/i.test(key))), true);
  }
});

test('AUTH-07/08: old Admin request cannot leak across a customer session into Admin 2', async () => {
  let finishOld;
  const oldResult = new Promise(resolve => { finishOld = resolve; });
  const backend = offlineRpc('owner-admin-1');
  const original = backend.client.rpc;
  let firstOverview = true;
  backend.client.rpc = name => {
    if (name === 'admin_customer_overview' && firstOverview) {
      firstOverview = false;
      return oldResult;
    }
    return original(name);
  };
  const service = createCustomerService(backend.client, { now });
  const oldWork = service.list();
  await new Promise(resolve => setImmediate(resolve));
  backend.selectUser('ordinary-customer');
  service.invalidate();
  await assert.rejects(service.list(), AccessDeniedError);
  backend.selectUser('owner-admin-2');
  service.invalidate();
  const newWork = await service.list();
  finishOld({ data: [{ ...FIXTURE[0], email: 'stale@example.invalid' }], error: null });
  assert.deepEqual(await oldWork, { stale: true, rows: [] });
  assert.equal(newWork.rows.length, 4);
  assert.equal(newWork.rows.some(row => row.email === 'stale@example.invalid'), false);
});

test('AUTH-10: direct RPC mock rejects customer even if UI checks are bypassed', async () => {
  const backend = offlineRpc('ordinary-customer');
  const result = await backend.client.rpc('admin_customer_overview');
  assert.equal(result.data, null);
  assert.equal(result.error.code, '42501');
});
