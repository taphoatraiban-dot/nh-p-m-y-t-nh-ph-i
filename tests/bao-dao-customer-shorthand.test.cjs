'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
test('Customer bao dao and dao xc shorthand keeps all four bets',()=>{
 const {rows,errors}=parse('hn\n6449b10..449 bao dao 1,dao xc5.\n44.49,94da1','2026-11-15');
 assert.deepEqual(errors,[]);
 assert.deepEqual(rows.map(r=>r.type),['B4','DAO BL','DAO XC','DA']);
 assert.deepEqual(rows.map(r=>r.points),[10,1,5,1]);
 assert.deepEqual(rows.map(r=>r.numbers),[['6449'],['449'],['449'],['44','49','94']]);
});
