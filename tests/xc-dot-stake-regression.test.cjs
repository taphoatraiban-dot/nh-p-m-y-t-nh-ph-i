'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
test('887xc.5. parses as 887xc5. (five points)',()=>{
 const a=parse('2dmn\n887xc.5.','2026-11-08');
 const b=parse('2dmn\n887xc5.','2026-11-08');
 assert.deepEqual(a.errors,b.errors);
 assert.deepEqual(a.rows,b.rows);
});
