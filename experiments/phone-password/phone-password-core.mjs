// Experimental server-only helpers. Not a complete authentication service.
// Never bundle this file into the browser.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const SCRYPT_OPTIONS = Object.freeze({ N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const MAX_PASSWORD_BYTES = 1024;

export function normalizeVietnamesePhone(value) {
  if (typeof value !== 'string') throw new TypeError('Invalid phone number');
  const compact = value.replace(/[\s.()-]/g, '');
  let local;
  if (/^0[35789]\d{8}$/.test(compact)) local = compact.slice(1);
  else if (/^\+84[35789]\d{8}$/.test(compact)) local = compact.slice(3);
  else if (/^84[35789]\d{8}$/.test(compact)) local = compact.slice(2);
  else throw new TypeError('Invalid Vietnamese mobile phone number');
  return '+84' + local;
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new TypeError('Password must be at least 12 characters and at most 1024 bytes');
  }
  return password;
}

export async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(32);
  const derived = await scrypt(password, salt, 64, SCRYPT_OPTIONS);
  return ['scrypt', '16384', '8', '1', salt.toString('base64url'), derived.toString('base64url')].join('$');
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES || typeof encoded !== 'string') return false;
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt' || parts[1] !== '16384' || parts[2] !== '8' || parts[3] !== '1') return false;
  try {
    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    if (salt.length !== 32 || expected.length !== 64 || salt.toString('base64url') !== parts[4] || expected.toString('base64url') !== parts[5]) return false;
    const actual = await scrypt(password, salt, 64, SCRYPT_OPTIONS);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
