import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresPhoneStore } from './postgres-phone-store.mjs';

test('parameterized queries and expected row mapping', async () => {
  const calls = [];
  const pool = { async query(sql, params) {
    calls.push({sql, params});
    if (sql.includes('returning id')) return { rows:[{id:'test-id'}] };
    if (sql.includes('select id, password_hash')) return {rows:[{id:'test-id',password_hash:'hash'}]};
    if (sql.includes('select s.account_id')) return {rows:[{account_id:'test-id',expires_at:new Date(Date.now()+60000),revoked_at:null}]};
    return {rows:[]};
  }};
  const store = createPostgresPhoneStore(pool);
  assert.equal((await store.createAccount({phone_e164:'+84901234567',password_hash:'hash'})).id,'test-id');
  assert.equal((await store.findAccountByPhone('+84901234567')).id,'test-id');
  assert.equal((await store.createSession({account_id:'test-id',token_hash:Buffer.alloc(32),expires_at:new Date()})).id,'test-id');
  assert.equal((await store.findSessionByTokenHash(Buffer.alloc(32))).account_id,'test-id');
  await store.revokeSessionByTokenHash(Buffer.alloc(32),new Date());
  assert.equal(calls.length,5);
  for(const c of calls) assert.match(c.sql,/\\$1/);
  assert.equal(calls[0].params[0],'+84901234567');
  assert.ok(calls[3].sql.includes('a.disabled_at is null'));
});
