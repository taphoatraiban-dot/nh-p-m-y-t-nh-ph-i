'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
for(const alias of ['k','keo','kéo','den']){
 test('HN 668'+alias+'968b1 expands exactly four B3 numbers',()=>{
  const {rows,errors}=parse('hn\n668'+alias+'968b1.','2026-11-15');
  assert.deepEqual(errors,[]);
  assert.deepEqual(rows.map(r=>r.numbers[0]),['668','768','868','968']);
  assert.deepEqual(rows.map(r=>r.type),['B3','B3','B3','B3']);
  assert.deepEqual(rows.map(r=>r.points),[1,1,1,1]);
 });
}
