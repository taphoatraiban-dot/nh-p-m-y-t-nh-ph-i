'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');

test('widely spaced Hanoi DA pairs equal compact DA wager',()=>{
 const canonical=parse('hn\n676869da1.','2026-11-15');
 assert.deepEqual(canonical.errors,[]);
 for(const raw of ['hn\n67 68 69da1.','hn\n67     68     69 da1.','hn\n67 68    69da1.']){
   const actual=parse(raw,'2026-11-15');
   assert.deepEqual(actual.errors,[],raw);
   assert.deepEqual(actual.rows,canonical.rows,raw);
 }
 assert.equal(canonical.rows.length,1);
 assert.deepEqual(canonical.rows[0].numbers,['67','68','69']);
});
