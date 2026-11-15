'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
test('Hanoi compact ₫1ng means da1n, not da1dn',()=>{
 const actual=parse('hn\n6768₫1ng','2026-11-15');
 const expected=parse('hn\n6768da1n.','2026-11-15');
 assert.deepEqual(actual.errors,[]);
 assert.deepEqual(actual.rows,expected.rows);
 assert.ok(actual.rows.length>0);
});
