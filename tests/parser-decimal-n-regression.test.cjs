'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');

for(const header of ['2dmn','2dmt','hn']){
 for(const wager of ['519b0,5n.','619b0,5n.','208b0,5n.','715b0,5n.']){
  test(header+' accepts '+wager+' without changing fractional points',()=>{
   const result=parse(header+'\n'+wager);
   assert.deepEqual(result.errors,[]);
   assert.equal(result.rows.length,1);
   assert.equal(result.rows[0].points,0.5);
   assert.equal(result.rows[0].type,'B3');
  });
 }
}
test('multiple decimal-n wagers keep every bet and point value',()=>{
 const result=parse('2dmn\n519b0,5n.\n619b0,5n.\n208b0,5n.\n223b3,5n.\n715b0,5n.\n793b5n.');
 assert.deepEqual(result.errors,[]);
 assert.deepEqual(result.rows.map(r=>r.points),[0.5,0.5,0.5,3.5,0.5,5]);
});
test('adjacent decimal-n wagers stay separate',()=>{
 const result=parse('2dmn\n519b0,5n.619b0,5n.');
 assert.deepEqual(result.errors,[]);
 assert.equal(result.rows.length,2);
});
for(const invalid of ['519duau0,5n.','519b0,5xyz.','519b0,5n.619duau0,5n.']){
 test('invalid syntax stays blocked: '+invalid,()=>{
  const result=parse('2dmn\n'+invalid);
  assert.ok(result.errors.length>0);
  assert.equal(result.rows.length,0);
 });
}
