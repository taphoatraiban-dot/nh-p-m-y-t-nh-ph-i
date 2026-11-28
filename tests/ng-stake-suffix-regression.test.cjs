'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');

test('ng suffix is normalized consistently for DA, XC, and B bets',()=>{
  const raw=[
    '3đmn.0033đ1ng.2đmn 000xc25ng',
    '2đmt 625b2ng.xc25ng .2539đa1.',
    '039xc15n',
    'hn',
    '810b1n.xc20ng 1028đ1ng.068xc15.',
  ].join('\n');
  const explicitN=[
    '3đmn.0033đ1n.2đmn 000xc25n',
    '2đmt 625b2n.xc25n .2539đa1.',
    '039xc15n',
    'hn',
    '810b1n.xc20n 1028đ1n.068xc15.',
  ].join('\n');
  const actual=parse(raw,'2026-11-28');
  const expected=parse(explicitN,'2026-11-28');
  assert.deepEqual(actual.errors,[]);
  assert.deepEqual(expected.errors,[]);
  assert.deepEqual(actual.rows,expected.rows);
});
