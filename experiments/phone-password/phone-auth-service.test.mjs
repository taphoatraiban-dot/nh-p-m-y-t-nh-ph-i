import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPhoneAuthService, AuthError } from './phone-auth-service.mjs';

function setup() {
  const accounts = new Map(), sessions = new Map();
  const store = {
    async createAccount(a) {
      if (accounts.has(a.phone_e164)) { const e = new Error('unique'); e.code = '23505'; throw e; }
      const account = { ...a, id: randomUUID() };
      accounts.set(a.phone_e164, account);
      return account;
    },
    async findAccountByPhone(phone) { return accounts.get(phone) ?? null; },
    async createSession(s) { sessions.set(s.token_hash.toString('hex'), s); },
    async findSessionByTokenHash(hash) { return sessions.get(hash.toString('hex')) ?? null; },
    async revokeSessionByTokenHash(hash, at) {
      const s = sessions.get(hash.toString('hex')); if (s) s.revoked_at = at;
    }
  };
  let allow = true;
  const limiter = { async consume() { return allow; } };
  return { auth: createPhoneAuthService({ store, limiter }), block() { allow = false; } };
}
const password = 'strong-test-password-2026!';
test('register login authenticate logout lifecycle (in-memory store)', async () => {
  const { auth } = setup();
  const reg = await auth.register({phone:'0901234567',password,clientKey:'test'});
  assert.equal(reg.phoneVerified,false);
  const login = await auth.login({phone:'+84901234567',password,clientKey:'test'});
  assert.equal(login.phoneVerified,false);
  assert.equal((await auth.authenticate(login.token)).accountId,reg.accountId);
  await auth.logout(login.token);
  assert.equal(await auth.authenticate(login.token),null);
});
test('duplicate phone and wrong password rejected', async () => {
  const { auth } = setup();
  await auth.register({phone:'0901234567',password,clientKey:'test'});
  await assert.rejects(auth.register({phone:'+84901234567',password,clientKey:'test'}), e=>e instanceof AuthError && e.code==='REGISTRATION_UNAVAILABLE');
  await assert.rejects(auth.login({phone:'0901234567',password:'wrong',clientKey:'test'}),e=>e.code==='INVALID_CREDENTIALS');
  await assert.rejects(auth.login({phone:'0909999999',password,clientKey:'test'}),e=>e.code==='INVALID_CREDENTIALS');
});
test('rate limiter rejects before account operations', async () => {
  const { auth, block } = setup(); block();
  await assert.rejects(auth.register({phone:'0901234567',password,clientKey:'test'}),e=>e.code==='RATE_LIMITED');
});
