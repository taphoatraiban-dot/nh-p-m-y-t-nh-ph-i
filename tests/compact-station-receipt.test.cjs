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
