'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareCommand, createCommandService, CommandRejectedError } = require('../src/admin-customer-commands.cjs');
const { calculateRenewedExpiry } = require('../src/admin-customer-renewal.cjs');

const USER = 'demo-customer-uuid';
const EMAIL = 'customer@example.invalid';
const REASON = 'Khách hàng yêu cầu hỗ trợ thử nghiệm';
const UUID = '12345678-1234-4123-8123-123456789abc';
const command = (action, extras = {}) => ({ action, userId: USER, email: EMAIL, confirmation: EMAIL, reason: REASON, revision: 0, ...extras });

function memoryServer() {
  let actor = 'admin-1';
  const admins = new Set(['admin-1', 'admin-2']);
  const customer = { revision: 0, active: true, daysExtended: 0, deviceCount: 2, expiresAt: '2026-10-20T03:00:00Z' };
  const events = [];
  const seen = new Map();
  const calls = [];
  async function rpc(name, args) {
    calls.push(name);
    if (name === 'check_email_license') return { data: { success: true, is_admin: admins.has(actor) }, error: null };
    if (name !== 'admin_customer_command') throw new Error('RPC not supported: ' + name);
    // Simulated *server-side* authorization and atomic idempotency/version check.
    if (!admins.has(actor)) return { data: null, error: { code: '42501' } };
    if (seen.has(args.p_request_id)) return { data: seen.get(args.p_request_id), error: null };
    if (args.p_user_id !== USER || args.p_expected_revision !== customer.revision) {
      return { data: null, error: { code: '409', message: 'Revision conflict' } };
    }
    switch (args.p_action) {
      case 'extend':
        customer.expiresAt = calculateRenewedExpiry({ expiresAt: customer.expiresAt, days: args.p_days, now: new Date('2026-10-26T03:00:00Z') });
        customer.daysExtended += args.p_days;
        break;
      case 'pause': customer.active = false; break;
      case 'resume': customer.active = true; break;
      case 'reset_device': customer.deviceCount = 0; break;
      default: return { data: null, error: { code: '400' } };
    }
    customer.revision += 1;
    events.push({ admin: actor, action: args.p_action, reason: args.p_reason, requestId: args.p_request_id });
    const result = { success: true, revision: customer.revision };
    seen.set(args.p_request_id, result);
    return { data: result, error: null };
  }
  return { client: { rpc }, customer, events, calls, selectActor(value) { actor = value; } };
}

test('requires exact email confirmation, reason, revision and bounded extension', () => {
  assert.throws(() => prepareCommand(command('reset_device', { confirmation: 'wrong@example.invalid' })), CommandRejectedError);
  assert.throws(() => prepareCommand(command('extend', { days: 366 })), CommandRejectedError);
  assert.throws(() => prepareCommand(command('extend', { days: 0 })), CommandRejectedError);
  assert.throws(() => prepareCommand(command('pause', { revision: -1 })), CommandRejectedError);
  assert.throws(() => prepareCommand(command('resume', { reason: 'short' })), CommandRejectedError);
  assert.throws(() => prepareCommand(command('delete' )), CommandRejectedError);
  assert.equal(prepareCommand(command('extend', { days: 30 })).days, 30);
});

test('both Admin logins can extend, pause, resume, and reset fake devices with separate audit identities', async () => {
  const server = memoryServer();
  let id = 0;
  const service = createCommandService(server.client, { generateId: () => UUID.slice(0, -1) + String(++id) });
  await service.execute(command('extend', { days: 30 }));
  server.selectActor('admin-2');
  await service.execute(command('pause', { revision: 1 }));
  await service.execute(command('resume', { revision: 2 }));
  await service.execute(command('reset_device', { revision: 3 }));
  assert.equal(server.customer.daysExtended, 30);
  assert.equal(server.customer.expiresAt, '2026-11-25T03:00:00.000Z');
  assert.equal(server.customer.active, true);
  assert.equal(server.customer.deviceCount, 0);
  assert.equal(server.customer.revision, 4);
  assert.deepEqual(server.events.map(e => e.admin), ['admin-1', 'admin-2', 'admin-2', 'admin-2']);
  assert.equal(server.events.length, 4);
  assert.equal(server.events.every(e => e.reason === REASON), true);
});

test('renewing again while active extends from prior expiry and preserves paused flag', async () => {
  const server = memoryServer();
  let id = 0;
  const service = createCommandService(server.client, { generateId: () => UUID.slice(0, -1) + String(++id) });
  await service.execute(command('pause'));
  await service.execute(command('extend', { revision: 1, days: 30 }));
  await service.execute(command('extend', { revision: 2, days: 10 }));
  assert.equal(server.customer.expiresAt, '2026-12-05T03:00:00.000Z');
  assert.equal(server.customer.active, false, 'renewing must not unpause the customer');
});

test('customer fails authorization; no write command reaches RPC', async () => {
  const server = memoryServer();
  server.selectActor('customer');
  const service = createCommandService(server.client, { generateId: () => UUID });
  await assert.rejects(service.execute(command('pause')), CommandRejectedError);
  assert.deepEqual(server.calls, ['check_email_license']);
  assert.equal(server.events.length, 0);
});

test('server prevents stale revision from overwriting newer admin change', async () => {
  const server = memoryServer();
  let id = 0;
  const service = createCommandService(server.client, { generateId: () => UUID.slice(0, -1) + String(++id) });
  await service.execute(command('pause'));
  server.selectActor('admin-2');
  await assert.rejects(service.execute(command('extend', { days: 10, revision: 0 })), CommandRejectedError);
  assert.equal(server.customer.daysExtended, 0);
  assert.equal(server.events.length, 1);
});

test('server mock applies repeated request ID only once', async () => {
  const server = memoryServer();
  const args = { p_request_id: UUID, p_action: 'extend', p_user_id: USER, p_expected_revision: 0, p_days: 20, p_reason: REASON };
  const first = await server.client.rpc('admin_customer_command', args);
  const second = await server.client.rpc('admin_customer_command', args);
  assert.deepEqual(first, second);
  assert.equal(server.customer.daysExtended, 20);
  assert.equal(server.events.length, 1);
});

test('failed and stale responses never claim a confirmed write', async () => {
  let resolveWrite;
  const server = { rpc: async name => name === 'check_email_license'
    ? { data: { success: true, is_admin: true }, error: null }
    : new Promise(resolve => { resolveWrite = resolve; }) };
  const service = createCommandService(server, { generateId: () => UUID });
  const pending = service.execute(command('pause'));
  await new Promise(resolve => setImmediate(resolve));
  service.invalidate();
  resolveWrite({ data: { success: true }, error: null });
  assert.deepEqual(await pending, { stale: true });
});
