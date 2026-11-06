'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
const prefix='Hn\n6694 bdao1n.\n';
const suffix='\n94,64da2n.dd10n';
const baseline=parse(prefix+'694 bdao1n xdao10n.'+suffix,'2026-11-06');
test('decorative trailing punctuation does not change valid wager totals',()=>{
 assert.deepEqual(baseline.errors,[]);
 for(const ending of ['..,',".,/-?![]{}#%^*++=_\\|~<>$¥€•.,?!'",'.','!!!',';:']){
  const actual=parse(prefix+'694 bdao1n xdao10n'+ending+suffix,'2026-11-06');
  assert.deepEqual(actual.errors,[],ending);
  assert.equal(actual.rows.reduce((sum,r)=>sum+r.gross,0),baseline.rows.reduce((sum,r)=>sum+r.gross,0),ending);
  assert.equal(actual.rows.length,baseline.rows.length,ending);
 }
});
test('letters after trailing punctuation remain invalid',()=>{
 const actual=parse(prefix+'694 bdao1n xdao10n..,XYZ'+suffix,'2026-11-06');
 assert.ok(actual.errors.length>0);
});
