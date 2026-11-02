// Experimental server-only auth service. NOT a Supabase Auth session.
// No existing application privileges may be granted using these sessions.
// Store must implement createAccount, findAccountByPhone, createSession,
// findSessionByTokenHash, revokeSessionByTokenHash using a private database.
import { normalizeVietnamesePhone, validatePassword, hashPassword, verifyPassword } from './phone-password-core.mjs';
import { newSessionToken, sessionTokenHash, sessionIsActive } from './session-core.mjs';

export class AuthError extends Error {
  constructor(code) { super(code); this.name = 'AuthError'; this.code = code; }
}
const FAIL = 'INVALID_CREDENTIALS';
const DUMMY_HASH_PROMISE = hashPassword('not-a-real-account-password-2026');

export function createPhoneAuthService({ store, limiter, now = () => new Date() }) {
  if (!store || !limiter || typeof limiter.consume !== 'function') throw new TypeError('Missing server-side store or rate limiter');
  async function checkLimit(key) {
    if (!await limiter.consume(key)) throw new AuthError('RATE_LIMITED');
  }
  return {
    async register({ phone, password, clientKey }) {
      await checkLimit('register:' + String(clientKey || 'unknown'));
      let normalized;
      try { normalized = normalizeVietnamesePhone(phone); validatePassword(password); }
      catch { throw new AuthError('INVALID_INPUT'); }
      const encoded = await hashPassword(password);
      try {
        const account = await store.createAccount({ phone_e164: normalized, password_hash: encoded, phone_verified: false });
        return { accountId: account.id, phoneVerified: false };
      } catch (err) {
        if (err?.code === '23505') throw new AuthError('REGISTRATION_UNAVAILABLE');
        throw err;
      }
    },
    async login({ phone, password, clientKey }) {
      await checkLimit('login-ip:' + String(clientKey || 'unknown'));
      let normalized;
      try { normalized = normalizeVietnamesePhone(phone); }
      catch { throw new AuthError(FAIL); }
      await checkLimit('login-phone:' + normalized);
      if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 1024) throw new AuthError(FAIL);
      const account = await store.findAccountByPhone(normalized);
      const matches = await verifyPassword(password, account?.password_hash ?? await DUMMY_HASH_PROMISE);
      if (!account || account.disabled_at || !matches) throw new AuthError(FAIL);
      const token = newSessionToken();
      const expiresAt = new Date(now().getTime() + 24 * 60 * 60 * 1000);
      await store.createSession({ account_id: account.id, token_hash: sessionTokenHash(token), expires_at: expiresAt });
      return { token, expiresAt: expiresAt.toISOString(), phoneVerified: Boolean(account.phone_verified) };
    },
    async authenticate(token) {
      let tokenHash;
      try { tokenHash = sessionTokenHash(token); } catch { return null; }
      const session = await store.findSessionByTokenHash(tokenHash);
      if (!sessionIsActive(session, now())) return null;
      return { accountId: session.account_id, phoneVerified: false, scope: 'phone-auth-experiment-only' };
    },
    async logout(token) {
      let tokenHash;
      try { tokenHash = sessionTokenHash(token); } catch { return; }
      await store.revokeSessionByTokenHash(tokenHash, now());
    }
  };
}
