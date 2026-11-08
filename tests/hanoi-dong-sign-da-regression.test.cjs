'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
test('Hanoi ₫a1 is parsed identically to da1',()=>{
 const raw='hn\n07.70da5.\n13.31.57.75.₫a1..\n24.67da2.';
 const expected=raw.replace(/₫a(?=\s*\d)/gi,'da');
 const actual=parse(raw,'2026-11-08');
 const normalized=parse(expected,'2026-11-08');
 assert.deepEqual(actual.errors,normalized.errors);
 assert.deepEqual(actual.rows,normalized.rows);
});
