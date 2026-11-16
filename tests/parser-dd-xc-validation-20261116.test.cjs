'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
const date='2026-11-16';
const hasNumber=(rows,n)=>rows.some(r=>(r.numbers||[]).includes(n));
test('TPH alias resolves without losing a valid bao wager',()=>{
 const r=parse('tph\n88b10.',date);
 assert.deepEqual(r.errors,[]);
 assert.ok(hasNumber(r.rows,'88'));
});
test('DD never silently converts three-digit input to a two-digit bet',()=>{
 const r=parse('tph\n888.88dd10.',date);
 assert.ok(!hasNumber(r.rows,'888'),'three-digit DD must not be charged');
 assert.ok(r.errors.length>0,'invalid three-digit DD must be reported');
});
test('XC never silently converts four-digit input to a three-digit bet',()=>{
 const r=parse('tph\n8889xc10.',date);
 assert.ok(!hasNumber(r.rows,'8889'),'four-digit XC must not be charged');
 assert.ok(r.errors.length>0,'invalid four-digit XC must be reported');
});
test('valid three-digit XC stays accepted',()=>{
 const r=parse('tph\n889xc10.',date);
 assert.deepEqual(r.errors,[]);
 assert.ok(hasNumber(r.rows,'889'));
});
test('four-digit bao stays accepted',()=>{
 const r=parse('tph\n8889b10.',date);
 assert.deepEqual(r.errors,[]);
 assert.ok(hasNumber(r.rows,'8889'));
});
