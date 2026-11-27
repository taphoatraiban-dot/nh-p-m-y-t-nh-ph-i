'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');

test('customer shorthand with trailing station group headers matches normalized phoi',()=>{
  const raw=[
    '25.52.₫a2..26.62.10.₫a1..01.10.39.₫a1..2₫ai..mn',
    '19.52.₫a2.2₫ai..mt',
    '0912..2912..912.b2..3₫ai..mn',
    '19.b10n..2₫ai.mt',
    '27.91.₫a3..19.52.₫a2..27.72.39.93.₫a1..125..165.xc10.b2..25.65.39.₫a1..hn',
  ].join('\n');
  const normalized=[
    '2dmn',
    '25.52da2. 26.62.10da1. 01.10.39da1.',
    '2dmt',
    '19.52da2.',
    '3dmn',
    '0912.2912b2. 912b2.',
    '2dmt',
    '19b10n.',
    'hn',
    '27.91da3.',
    '19.52da2.',
    '27.72.39.93da1. 125.165.xc10.b2.',
    '25.65.39da1.',
  ].join('\n');
  const actual=parse(raw,'2026-11-27');
  const expected=parse(normalized,'2026-11-27');
  assert.deepEqual(actual.errors,[]);
  assert.deepEqual(expected.errors,[]);
  assert.deepEqual(actual.rows,expected.rows);
});
