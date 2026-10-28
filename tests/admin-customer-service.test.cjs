'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCustomerService, AccessDeniedError } = require('../src/admin-customer-service.cjs');

const date = () => new Date('2026-10-26T00:00:00Z');
const safeRow = { account_kind: 'registered', user_id: 'demo-id', email: 'demo@example.com', license_active: true, expires_at: '2026-11-26T00:00:00Z', device_count: 1 };

test('authorized admin receives only sanitized rows', async () => {
  const called = [];
  const client = { async rpc(name) {
    called.push(name);
    if (name === 'check_email_license') return { data: { success: true, is_admin: true }, error: null };
    return { data: [{ ...safeRow, api_key: 'SECRET', pin: '1234' }], error: null };
  } };
  const result = await createCustomerService(client, { now: date }).list();
  assert.deepEqual(called, ['check_email_license', 'admin_customer_overview']);
  assert.equal(result.stale, false);
  assert.equal(result.rows[0].status, 'active');
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
  assert.equal(JSON.stringify(result).includes('1234'), false);
});

test('non-admin never invokes the overview RPC', async () => {
  const called = [];
  const client = { async rpc(name) { called.push(name); return { data: { success: true, is_admin: false }, error: null }; } };
  await assert.rejects(createCustomerService(client, { now: date }).list(), AccessDeniedError);
  assert.deepEqual(called, ['check_email_license']);
});

test('admin authorization requires explicit boolean true, never a truthy value', async () => {
  for (const value of ['true', 1, {}, null, undefined]) {
    const called = [];
    const client = { async rpc(name) {
      called.push(name);
      return { data: { success: true, is_admin: value }, error: null };
    } };
    await assert.rejects(createCustomerService(client).list(), AccessDeniedError);
    assert.deepEqual(called, ['check_email_license']);
  }
});

test('failed license verification fails closed', async () => {
  const client = { async rpc() { return { data: null, error: new Error('offline') }; } };
  await assert.rejects(createCustomerService(client).list(), /kiểm tra/);
});

test('failed overview request never falls back to an unsafe list', async () => {
  const called = [];
  const client = { async rpc(name) {
    called.push(name);
    return name === 'check_email_license'
      ? { data: { success: true, is_admin: true }, error: null }
      : { data: null, error: new Error('missing RPC') };
  } };
  await assert.rejects(createCustomerService(client).list(), /Không tải/);
  assert.deepEqual(called, ['check_email_license', 'admin_customer_overview']);
});

test('both owner admin logins see the same records and can filter by status', async () => {
  const source = [safeRow, { account_kind: 'pending', user_id: null, email: 'waiting@example.com', license_active: true, expires_at: '2026-11-26T00:00:00Z', device_count: 0 }];
  function loginAs(adminId) {
    return createCustomerService({ async rpc(name) {
      if (name === 'check_email_license') return { data: { success: true, is_admin: adminId === 'owner-admin-1' || adminId === 'owner-admin-2' }, error: null };
      if (name === 'admin_customer_overview') return { data: source, error: null };
      throw new Error('Unexpected RPC');
    } }, { now: date });
  }
  const first = await loginAs('owner-admin-1').list();
  const second = await loginAs('owner-admin-2').list();
  assert.deepEqual(first.rows, second.rows);
  assert.equal((await loginAs('owner-admin-1').list({ status: 'pending' })).rows[0].email, 'waiting@example.com');
  assert.equal((await loginAs('owner-admin-2').list({ search: 'demo@' })).rows[0].email, 'demo@example.com');
  await assert.rejects(loginAs('customer').list(), AccessDeniedError);
});

test('invalidate discards an in-flight result after session change', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const client = { async rpc(name) {
    return name === 'check_email_license'
      ? { data: { success: true, is_admin: true }, error: null }
      : pending;
  } };
  const service = createCustomerService(client, { now: date });
  const work = service.list();
  await new Promise(resolve => setImmediate(resolve));
  service.invalidate();
  release({ data: [safeRow], error: null });
  assert.deepEqual(await work, { stale: true, rows: [] });
});

test('session switch during license verification never invokes account listing', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const called = [];
  const client = { async rpc(name) {
    called.push(name);
    if (name === 'check_email_license') return pending;
    return { data: [safeRow], error: null };
  } };
  const service = createCustomerService(client, { now: date });
  const work = service.list();
  service.invalidate();
  release({ data: { success: true, is_admin: true }, error: null });
  assert.deepEqual(await work, { stale: true, rows: [] });
  assert.deepEqual(called, ['check_email_license']);
});

test('rapid Admin 1 to customer to Admin 2 session switch discards old results', async () => {
  let finishOld;
  const oldRows = new Promise(resolve => { finishOld = resolve; });
  let licenseCheck = 0;
  const client = { async rpc(name) {
    if (name === 'check_email_license') {
      licenseCheck += 1;
      return { data: { success: true, is_admin: licenseCheck !== 2 }, error: null };
    }
    if (name === 'admin_customer_overview') {
      return licenseCheck === 1 ? oldRows : { data: [{ ...safeRow, email: 'admin2-view@example.com' }], error: null };
    }
    throw new Error('Unexpected RPC');
  } };
  const service = createCustomerService(client, { now: date });
  const firstAdmin = service.list();
  await new Promise(resolve => setImmediate(resolve));
  service.invalidate(); // Auth session changed to ordinary customer.
  await assert.rejects(service.list(), AccessDeniedError);
  service.invalidate(); // Separate login for Admin 2.
  const secondAdmin = await service.list();
  finishOld({ data: [safeRow], error: null });
  assert.deepEqual(await firstAdmin, { stale: true, rows: [] });
  assert.equal(secondAdmin.rows[0].email, 'admin2-view@example.com');
});
