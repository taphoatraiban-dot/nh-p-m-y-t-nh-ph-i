'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, '../prototypes/sql/admin_customer_command.review_only.sql'), 'utf8').toLowerCase();

test('SQL proposal has a rollback tail and is never a production migration', () => {
  assert.match(sql, /review only/);
  assert.match(sql, /^begin;/m);
  assert.match(sql.trimEnd(), /rollback;$/);
  assert.doesNotMatch(sql, /drop table|truncate|delete from public\.email_licenses/);
});

test('server function denies non-owner Admin callers and owner accounts as targets', () => {
  assert.match(sql, /v_actor uuid := auth\.uid\(\)/);
  assert.match(sql, /from public\.admin_users where user_id = v_actor/);
  assert.match(sql, /from public\.admin_users where user_id = p_user_id/);
  assert.match(sql, /from public\.profiles where id = p_user_id and role = 'admin'/);
  assert.doesNotMatch(sql, /user_metadata|raw_user_meta_data/);
});

test('idempotency, revision lock and audit are transactional by design', () => {
  assert.match(sql, /request_id uuid primary key/);
  assert.match(sql, /on conflict \(request_id\) do nothing/);
  assert.match(sql, /p_expected_revision/);
  assert.match(sql, /where user_id = p_user_id for update/);
  assert.match(sql, /result_revision = v_revision \+ 1/);
  assert.match(sql, /actor_id uuid not null/);
});

test('renewal uses server time and saves device record before clearing binding', () => {
  assert.match(sql, /greatest\(v_expiry, now\(\)\) \+ \(p_days \* interval '1 day'\)/);
  assert.match(sql, /set timezone = 'utc'/);
  const backup = sql.indexOf('insert into public.admin_device_reset_history(', sql.indexOf('elsif p_action = \'reset_device\''));
  const remove = sql.indexOf('delete from public.devices', backup);
  assert.ok(backup > 0 && remove > backup);
});

test('new public tables have RLS enabled and no direct client grants', () => {
  for (const table of ['admin_customer_revisions','admin_customer_commands','admin_device_reset_history']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`));
  }
  assert.match(sql, /revoke all on function public\.admin_customer_command/);
  assert.match(sql, /grant execute on function public\.admin_customer_command/);
});
