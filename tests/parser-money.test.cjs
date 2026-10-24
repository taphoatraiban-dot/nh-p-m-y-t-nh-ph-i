'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
const gross=r=>r.rows.reduce((s,x)=>s+x.gross,0);
const regions=[{head:'tpho',region:'N',rates:[18,17,16],xc:2,dd:2},
 {head:'dnang',region:'T',rates:[18,17,16],xc:2,dd:2},
 {head:'hn',region:'B',rates:[27,23,20],xc:4,dd:5}];
for(const r of regions)for(const [digits,index] of [['01',0],['001',1],['0001',2]])for(const stake of [1,0.5,10]){
 const raw=r.head+'\n'+digits+'b'+String(stake).replace('.',',')+'.';
 test('parse to gross: '+raw,()=>{
  const x=parse(raw);assert.deepEqual(x.errors,[]);assert.equal(x.rows.length,1);
  assert.equal(x.rows[0].numbers[0],digits);assert.equal(x.rows[0].region,r.region);
  assert.equal(gross(x),r.rates[index]*stake);
 });
}
for(const r of regions)for(const stake of [1,0.5,10])for(const [num,typ,rate] of [['123','xc',r.xc],['12','dd',r.dd]]){
 test(`parse ${r.head} ${num}${typ}${stake}`,()=>{
  const x=parse(r.head+'\n'+num+typ+String(stake).replace('.',',')+'.');
  assert.deepEqual(x.errors,[]);assert.equal(gross(x),rate*stake);
 });
}
for(const r of regions)for(const phrase of ['bdao','đảo lô ','đảolô','dao lo ']){
 test(`keep four digits for chained ${r.head} ${phrase}`,()=>{
  const x=parse(r.head+'\n5645B12.'+phrase+'1.');
  assert.deepEqual(x.errors,[]);assert.equal(x.rows.length,2);
  assert.ok(x.rows.every(row=>row.numbers.join('')==='5645'));
  assert.equal(gross(x),(12+12)*r.rates[2]);
 });
}
for(const head of ['hn','tpho','dnang'])for(const wager of ['444.55xc5.','66.666dd10.','778877da1.','12345da1.']){
 test('block malformed '+head+' '+wager,()=>{
  const x=parse(head+'\n'+wager);assert.ok(x.errors.length>0);assert.equal(x.rows.length,0);
 });
}
test('missing station is rejected',()=>assert.ok(parse('121314da1.').errors.length>0));
test('two explicit identical wagers both count',()=>{
 const r=parse('hn\n65b10.\n65b10.');assert.deepEqual(r.errors,[]);assert.equal(r.rows.length,2);assert.equal(gross(r),540);
});
test('2dmn XC ten points is 40 thousand',()=>assert.equal(gross(parse('2dmn\n123xc10.')),40));
test('three and four station expansion preserves total',()=>{
 for(const [head,count] of [['3dmn',3],['4dmn',4]]){
  const r=parse(head+'\n12b1.');assert.deepEqual(r.errors,[]);assert.equal(r.rows.length,count);assert.equal(gross(r),18*count);
 }
});
test('explicit repeated digits permutation counted once',()=>{
 const r=parse('hn\n6633bdao1.');assert.deepEqual(r.errors,[]);assert.equal(gross(r),6*20);
});
test('DA followed by B retains pair semantics',()=>{
 const r=parse('hn\n1234da1.b2.');assert.deepEqual(r.errors,[]);assert.equal(gross(r),54+2*27*2);
});
