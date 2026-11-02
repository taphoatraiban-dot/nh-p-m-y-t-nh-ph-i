import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVietnamesePhone, validatePassword, hashPassword, verifyPassword } from './phone-password-core.mjs';

test('normalizes valid VN mobile numbers to E.164', () => {
  assert.equal(normalizeVietnamesePhone('090 123 4567'), '+84901234567');
  assert.equal(normalizeVietnamesePhone('84901234567'), '+84901234567');
  assert.equal(normalizeVietnamesePhone('+84 901 234 567'), '+84901234567');
});
test('rejects malformed and landline numbers', () => {
  for (const value of ['123', '02812345678', '+849012345678', '0901234567x', '+840901234567']) {
    assert.throws(() => normalizeVietnamesePhone(value));
  }
});
test('rejects weak and oversized passwords', () => {
  assert.throws(() => validatePassword('short'));
  assert.throws(() => validatePassword('x'.repeat(1025)));
});
test('hashes and verifies without exposing plaintext', async () => {
  const password = 'test-only-StrongPassword-2026!';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('incorrect-password', first), false);
  assert.equal(await verifyPassword(password, 'invalid-hash'), false);
});
