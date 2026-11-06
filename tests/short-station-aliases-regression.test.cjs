'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
const pairs=[['2mn','2dmn'],['2mt','2dmt'],['2dn','2dmn'],['2dt','2dmt'],['3dn','3dmn'],['3dt','3dmt'],['4dn','4dmn'],['4mn','4dmn']];
for(const [alias,canonical] of pairs){
 test(alias+' retains calculation equivalence to '+canonical,()=>{
  const actual=parse(alias+'\n12b1.','2026-11-06');
  const expected=parse(canonical+'\n12b1.','2026-11-06');
  assert.deepEqual(actual.errors,[]);
  assert.deepEqual(actual.rows.map(r=>[r.region,r.gross,r.type]),expected.rows.map(r=>[r.region,r.gross,r.type]));
 });
}
