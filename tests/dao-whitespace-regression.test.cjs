'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {parse}=require('./helpers/production-parser.cjs');
const forms=['636.336 bdao1n xdao10n,','636.336.bdao1n.xdao10n,','636.336 bdao1n.xdao10n,'];
for(const form of forms){
 test('DAO whitespace and dot separators: '+form,()=>{
  const result=parse('2dmt\n6336 bdao1n.\n'+form,'2026-11-06');
  assert.deepEqual(result.errors,[]);
  assert.equal(result.rows.reduce((sum,row)=>sum+row.gross,0),636);
  for(const n of ['636','336'])assert.equal(result.rows.find(row=>row.type==='DAO BL'&&row.numbers.includes(n))?.gross,102);
 });
}
