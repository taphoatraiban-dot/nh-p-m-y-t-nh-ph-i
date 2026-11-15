'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
test('668k968b1 expands to four distinct B3 bets in HN',()=>{
 const {rows,errors}=parse('hn\n668k968b1.','2026-11-15');
 assert.deepEqual(errors,[]);
 assert.deepEqual(rows.map(r=>r.numbers[0]),['668','768','868','968']);
 assert.deepEqual(rows.map(r=>r.type),['B3','B3','B3','B3']);
 assert.deepEqual(rows.map(r=>r.points),[1,1,1,1]);
});
