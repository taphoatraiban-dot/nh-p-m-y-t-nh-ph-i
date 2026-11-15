'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');

test('dong-sign contextual shorthand matches explicit da and station groups',()=>{
  const raw=[
    '3dmn .4400₫a1.',
    '2₫mn 068xc20n',
    '3₫mt 049xc15n',
    '4955₫1n',
    'Hn .049b2ngxc25n',
    '4955₫2n',
    '055xc20n',
    '347xc15n',
  ].join('\n');
  const normalized=[
    '3dmn .4400da1.',
    '2dmn 068xc20n',
    '3dmt 049xc15n',
    '4955da1n',
    'Hn .049b2ngxc25n',
    '4955da2n',
    '055xc20n',
    '347xc15n',
  ].join('\n');
  const actual=parse(raw,'2026-11-15');
  const expected=parse(normalized,'2026-11-15');
  assert.deepEqual(actual.errors,expected.errors);
  assert.deepEqual(actual.rows,expected.rows);
  assert.ok(expected.rows.length>0,'expected wagers must produce parsed rows');
});
