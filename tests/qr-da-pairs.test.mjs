// Regression tests for QR receipt DA pair diagnostics.
// Run with: node --test tests/qr-da-pairs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

function countPairs(numbers, stationResults) {
  const counts = new Map(numbers.map(n => [n, 0]));
  for (const station of stationResults) {
    for (const value of station) {
      const suffix = String(value).slice(-2).padStart(2, '0');
      if (counts.has(suffix)) counts.set(suffix, counts.get(suffix) + 1);
    }
  }
  const pairs = [];
  for (let i = 0; i < numbers.length; i++)
    for (let j = i + 1; j < numbers.length; j++) {
      const times = Math.min(counts.get(numbers[i]), counts.get(numbers[j]));
      if (times > 0) pairs.push({ a: numbers[i], b: numbers[j], times });
    }
  return pairs;
}

test('straight: two numbers on one station count as one pair', () => {
  assert.deepEqual(countPairs(['47','74'], [['147','274']]), [{a:'47',b:'74',times:1}]);
});
test('cross: numbers on separate stations form one pair', () => {
  assert.deepEqual(countPairs(['47','74'], [['147'],['274']]), [{a:'47',b:'74',times:1}]);
});
test('cross: two numbers on the same station still form a pair', () => {
  assert.deepEqual(countPairs(['47','74'], [['147','274'],[]]), [{a:'47',b:'74',times:1}]);
});
test('cross: repeated occurrences use minimum count', () => {
  assert.deepEqual(countPairs(['47','74'], [['147','247'],['374']]), [{a:'47',b:'74',times:1}]);
});
test('cross: repeated occurrences on both sides count twice', () => {
  assert.deepEqual(countPairs(['47','74'], [['147','247'],['374','474']]), [{a:'47',b:'74',times:2}]);
});
test('three matching numbers create three distinct pairs', () => {
  assert.equal(countPairs(['47','74','91'], [['147','274','391']]).length,3);
});
test('no matching pair means no wins', () => {
  assert.deepEqual(countPairs(['47','74'], [['147'],[]]), []);
});
