'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
test('extra punctuation before station header is ignored',()=>{
 const a=parse('3dmn\n26.62da1.');
 const b=parse('...3dmn!!!\n26.62da1.');
 assert.deepEqual(b,a);
});
test('repeated separators between number and bet function are ignored',()=>{
 const a=parse('hn\n324xdao5.');
 const b=parse('hn\n324///xdao5.');
 assert.deepEqual(b,a);
});
test('repeated separators between numbers are normalized without losing wagers',()=>{
 const a=parse('hn\n0099.3939b2.');
 const b=parse('hn\n0099..3939b2.');
 assert.deepEqual(b,a);
});
test('decimal comma and decimal point are preserved',()=>{
 const a=parse('2dmn\n444874da0,5.');
 const b=parse('2dmn\n444874da0.5.');
 assert.deepEqual(a.errors,[]);
 assert.deepEqual(b.errors,[]);
});

test('punctuation-only header prefixes and suffixes preserve station parsing',()=>{
 const original=parse('hn\n88dd10.');
 for(const header of ['..hn','hn!!!','!!!hn???','~hn~']){
  assert.deepEqual(parse(header+'\n88dd10.'),original,header);
 }
});
test('decorative punctuation does not change original wager stake',()=>{
 const plain=parse('hn\n324xdao5.');
 for(const input of ['hn\n324///xdao5.','hn\n324:::xdao5.']){
  assert.deepEqual(parse(input),plain,input);
 }
});
