const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/ios-share-phoi.js'),'utf8');
function receipt(items){
  const labels=[];
  const ctx={fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(value){labels.push(String(value));}};
  const doc={createElement(){return {width:0,height:0,getContext(){return ctx;}};}};
  const sandbox={module:{exports:{}},window:null};
  vm.runInNewContext(source,sandbox);
  const canvas=sandbox.module.exports.render('[[TABLE80]]'+JSON.stringify({layout:'by-station-4col',items}),doc);
  return {labels,height:canvas.height};
}
const row=(station,amount,number='873',type='Bao 3',points='1')=>({station,amount,number,type,points});
test('four stations with identical bets print one table and correct sum',()=>{
  const r=receipt([row('TP.HCM','14k'),row('Long An','14k'),row('Bình Phước','14k'),row('Hậu Giang','14k')]);
  assert.equal(r.labels.filter(x=>x==='SỐ').length,1);
  assert(r.labels.includes('56k'));
  assert(r.labels.includes('TP.HCM + Long An + Bình Phước + Hậu Giang'));
});
test('different bets stay separate',()=>{
  const r=receipt([row('TP.HCM','14k'),row('Long An','14k','623')]);
  assert.equal(r.labels.filter(x=>x==='SỐ').length,2);
  assert(r.labels.includes('28k'));
});
test('invalid amount is not combined',()=>{
  const r=receipt([row('TP.HCM','chưa tính'),row('Long An','14k')]);
  assert.equal(r.labels.filter(x=>x==='SỐ').length,2);
});

test('2dmn and 4dmn print as two tables even with interleaved different bets',()=>{
  const items=[
    {...row('TP.HCM','10k','11'),groupCode:'2dmn'},
    {...row('Bình Phước','20k','22'),groupCode:'4dmn'},
    {...row('Long An','30k','33'),groupCode:'2dmn'},
    {...row('Hậu Giang','40k','44'),groupCode:'4dmn'}
  ];
  const r=receipt(items);
  assert.equal(r.labels.filter(x=>x==='SỐ').length,2);
  for(const number of ['11','22','33','44'])assert(r.labels.includes(number));
  assert(r.labels.includes('100k'));
});
test('identical numbers in 2dmn and 4dmn remain separate',()=>{
  const r=receipt([
    {...row('TP.HCM','10k','11'),groupCode:'2dmn'},
    {...row('TP.HCM','20k','11'),groupCode:'4dmn'}
  ]);
  assert.equal(r.labels.filter(x=>x==='SỐ').length,2);
  assert(r.labels.includes('30k'));
});

test('direct receipt compacts identical repeated bets and preserves 161k',()=>{
 const items=[];
 for(let i=0;i<3;i++)items.push(row('Đồng Nai + Cần Thơ + Sóc Trăng','7k','938','Bao 3','0.5n'));
 for(let i=0;i<3;i++)items.push(row('Đồng Nai + Cần Thơ + Sóc Trăng','7k','468','Bao 3','0.5n'));
 for(let i=0;i<3;i++)items.push(row('Đồng Nai + Cần Thơ + Sóc Trăng','15k','52','Bao 2','1n'));
 for(let i=0;i<3;i++)items.push(row('Đồng Nai + Cần Thơ + Sóc Trăng','15k','68','Bao 2','1n'));
 items.push(row('Đồng Nai + Cần Thơ','29k','86-68','DA','0.5n'));
 const result=receipt(items);
 for(const n of ['938','468','52','68','86-68'])assert.equal(result.labels.filter(x=>x===n).length,1);
 for(const amount of ['21k','45k','29k','161k','0.5n ×3','1n ×3'])assert(result.labels.includes(amount),amount);
 assert.equal(result.labels.filter(x=>x==='SỐ').length,2);
});
test('same number at different stations is not collapsed without provenance',()=>{
 const result=receipt([row('Đồng Nai','7k','938','Bao 3','0.5n'),row('Cần Thơ','7k','938','Bao 3','0.5n')]);
 assert(result.labels.includes('14k'));
 assert(!result.labels.includes('1n'));
});

test('different original points never combine into a higher stake',()=>{
 const result=receipt([row('Đồng Nai','7k','938','Bao 3','0,5n'),row('Đồng Nai','14k','938','Bao 3','1n')]);
 assert.equal(result.labels.filter(x=>x==='938').length,2);
 assert(!result.labels.includes('1,5n'));
 assert(result.labels.includes('21k'));
});
