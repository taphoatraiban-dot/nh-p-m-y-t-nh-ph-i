// Server-only session token helpers. Store ONLY tokenHash in the database.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export function newSessionToken() {
  return randomBytes(32).toString('base64url');
}
export function sessionTokenHash(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new TypeError('Invalid session token');
  }
  return createHash('sha256').update(token, 'utf8').digest();
}
export function sessionMatches(token, expectedHash) {
  try {
    const actual = sessionTokenHash(token);
    return Buffer.isBuffer(expectedHash) && expectedHash.length === 32 && timingSafeEqual(actual, expectedHash);
  } catch {
    return false;
  }
}
export function sessionIsActive(session, now = new Date()) {
  return Boolean(session && !session.revoked_at && session.expires_at &&
    new Date(session.expires_at).getTime() > now.getTime() &&
    !Number.isNaN(new Date(session.expires_at).getTime()));
}
