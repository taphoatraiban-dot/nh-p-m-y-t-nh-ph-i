// LOCAL EXPERIMENT ONLY: PostgreSQL integration test. Never point at production.
// Usage: PHONE_AUTH_TEST_DATABASE_URL=postgresql://... node --test postgres-phone-integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createPhoneAuthService } from './phone-auth-service.mjs';
import { createPostgresPhoneStore } from './postgres-phone-store.mjs';

const url = process.env.PHONE_AUTH_TEST_DATABASE_URL;
test('real PostgreSQL: register, login, logout and database persistence', { skip: !url && 'Set PHONE_AUTH_TEST_DATABASE_URL to an isolated local database' }, async (t) => {
  const parsed = new URL(url);
  if (!['localhost','127.0.0.1','::1'].includes(parsed.hostname)) throw new Error('Refusing non-local PostgreSQL host');
  const require = createRequire(import.meta.url);
  const { Pool } = require('pg');
  const pool = new Pool({connectionString:url, max:2, connectionTimeoutMillis:3000});
  t.after(async()=>pool.end());
  const store = createPostgresPhoneStore(pool);
  const limiter = { async consume() { return true; } }; // TEST ONLY; not safe for HTTP use
  const auth = createPhoneAuthService({store,limiter});
  // Use a unique generated number, and clean up via the test database connection.
  // This test is destructive only to the account it creates in the isolated local database.
  const suffix = String(randomBytes(4).readUInt32BE() % 100000000).padStart(8,'0');
  const phone = '+849' + suffix;
  let accountId;
  try {
    const registered = await auth.register({phone,password:'test-password-long-2026!',clientKey:'local'});
    accountId = registered.accountId;
    assert.equal(registered.phoneVerified,false);
    const login = await auth.login({phone,password:'test-password-long-2026!',clientKey:'local'});
    assert.equal((await auth.authenticate(login.token)).accountId,accountId);
    await auth.logout(login.token);
    assert.equal(await auth.authenticate(login.token),null);
  } finally {
    if(accountId) await pool.query('delete from phone_auth_private.accounts where id = $1',[accountId]);
  }
});
