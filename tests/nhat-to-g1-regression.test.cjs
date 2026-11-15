'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
test('Nhất To G1 recognizes 2 and 3 digit wagers across station groups',()=>{
 const result=parse('hn\n38nto10.\n438nhto10\n2dmn\n66.76nto10.','2026-11-15');
 assert.deepEqual(result.errors,[]);
 const rows=result.rows;
 assert.equal(rows.length,4);
 assert.deepEqual(rows.map(r=>r.type),['NHẤT TO 2','NHẤT TO 3','NHẤT TO 2','NHẤT TO 2']);
 assert.deepEqual(rows.map(r=>r.numbers[0]),['38','438','66','76']);
 assert.deepEqual(rows.map(r=>r.points),[10,10,10,10]);
});
