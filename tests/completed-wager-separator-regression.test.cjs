'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');

test('completed comma and semicolon delimiters do not merge or duplicate bets',()=>{
  const delimited=[
    'hn',
    '25.52da2,26.62da1.',
    '123xc5;456xc10.',
    '12.21dd10,34.43dd5.',
    '25.52da0,5.',
    '12,21da2.',
  ].join('\n');
  const explicitSpaces=[
    'hn',
    '25.52da2 26.62da1.',
    '123xc5 456xc10.',
    '12.21dd10 34.43dd5.',
    '25.52da0,5.',
    '12,21da2.',
  ].join('\n');
  const actual=parse(delimited,'2026-11-28');
  const expected=parse(explicitSpaces,'2026-11-28');
  assert.deepEqual(actual.errors,[]);
  assert.deepEqual(expected.errors,[]);
  assert.deepEqual(actual.rows,expected.rows);
});
