import test from 'node:test';
import assert from 'node:assert/strict';

// Owner-only QR result lookups must accept a real YYYY-MM-DD draw date.
// Keep the regex literal to one backslash before d, not two.
const drawDatePattern = /^\d{4}-\d{2}-\d{2}$/;
function validDrawDate(value) {
  if (typeof value !== 'string' || !drawDatePattern.test(value)) return false;
  const [y,m,d] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(y,m-1,d));
  return parsed.getUTCFullYear()===y && parsed.getUTCMonth()===m-1 && parsed.getUTCDate()===d;
}
test('accepts normal draw date', () => assert.equal(validDrawDate('2026-10-29'),true));
test('accepts leap-day in leap year', () => assert.equal(validDrawDate('2024-02-29'),true));
test('rejects impossible leap day', () => assert.equal(validDrawDate('2026-02-29'),false));
test('rejects invalid month', () => assert.equal(validDrawDate('2026-13-01'),false));
test('rejects invalid day', () => assert.equal(validDrawDate('2026-04-31'),false));
test('rejects wrong format', () => assert.equal(validDrawDate('29/10/2026'),false));
test('rejects appended data', () => assert.equal(validDrawDate('2026-10-29 extra'),false));
