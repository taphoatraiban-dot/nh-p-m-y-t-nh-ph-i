import test from 'node:test';
import assert from 'node:assert/strict';
import { newSessionToken, sessionTokenHash, sessionMatches, sessionIsActive } from './session-core.mjs';

test('issues random session tokens and only stores hashes', () => {
  const a = newSessionToken(), b = newSessionToken();
  assert.notEqual(a, b);
  assert.equal(a.length, 43);
  assert.equal(sessionTokenHash(a).length, 32);
  assert.equal(sessionMatches(a, sessionTokenHash(a)), true);
  assert.equal(sessionMatches(b, sessionTokenHash(a)), false);
});
test('rejects malformed tokens', () => {
  assert.throws(() => sessionTokenHash('bad'));
  assert.equal(sessionMatches('bad', Buffer.alloc(32)), false);
});
test('rejects expired and revoked sessions', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  assert.equal(sessionIsActive({expires_at:'2026-11-03T12:00:00Z',revoked_at:null},now), true);
  assert.equal(sessionIsActive({expires_at:'2026-11-01T12:00:00Z',revoked_at:null},now), false);
  assert.equal(sessionIsActive({expires_at:'2026-11-03T12:00:00Z',revoked_at:'2026-11-02T11:00:00Z'},now), false);
});
