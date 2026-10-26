'use strict';
// Regression: 2dmn 221bdao1 must recognize a 122 result in either chosen station.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {parse}=require('./helpers/production-parser.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function section(start,end){
  const a=html.indexOf('function '+start+'('),b=html.indexOf('function '+end+'(',a);
  assert.ok(a>=0&&b>a,`missing function section ${start}`);
  return html.slice(a,b);
}
const draw={province:'TP.HCM',date:'2026-10-26',pr:{g7:['122'],g8:['12']}};
const ctx=vm.createContext({
  cleanDigits:v=>String(v).replace(/\D/g,''),
  lastN:(v,n)=>String(v).replace(/\D/g,'').slice(-n),
  drawPrizes:d=>d.pr,
  regionDraws:()=>[draw],
  drawProvince:d=>d.province,
  $:()=>({value:'2026-10-26'}),
  uniqueDrawList:rows=>rows,
  drawDateKey:d=>d.date,
  provinceMatches:(name,d)=>name===d.province,
  lotteryResults:{N:[draw,{province:'Long An',date:'2026-10-26',pr:{g7:['999']}}]},
  resultForDA:()=>({}),resultForXC:()=>[],resultForDD:()=>[],resultForCross2DA:()=>({pairCount:0})
});
vm.runInContext(section('eligibleKeys','resultForXC')+section('resultForCross2B','resultForCross2DA')+section('scanRow','renderScan')+section('priceForRow','typeLabel'),ctx,{timeout:2000});

test('221bdao1 parses as DAO BL with three unique permutations',()=>{
  const result=parse('2dmn\n221bdao1.','2026-10-26');
  assert.deepEqual(result.errors,[]);
  assert.equal(result.rows.length,1);
  assert.equal(result.rows[0].type,'DAO BL');
  assert.equal(result.rows[0].gross,102); // 3 permutations × 17 × 2 stations
});

test('actual DAO BL matching accepts 122 from 221 and excludes unrelated numbers',()=>{
  const result=vm.runInContext('resultForB({type:"DAO BL",region:"N",numbers:["221"]}, '+JSON.stringify(draw)+')',ctx);
  assert.equal(result.length,1);
  assert.equal(result[0].value,'122');
});

test('2dmn DAO BL is routed through two-station winner scanner',()=>{
  const row=parse('2dmn\n221bdao1.','2026-10-26').rows[0];
  const result=vm.runInContext('scanRow('+JSON.stringify(row)+')',ctx);
  assert.equal(result.length,1);
  assert.equal(result[0].province,'TP.HCM');
  assert.equal(result[0].count,1);
  assert.match(result[0].detail,/122/);
});

test('2dmn DAO BL recognizes 122 in the second selected station',()=>{
  const row=parse('2dmn\n221bdao1.','2026-10-26').rows[0];
  assert.deepEqual(row.crossProvinces,['TP.HCM','Đồng Tháp']);
  const original=ctx.lotteryResults.N;
  try {
    ctx.lotteryResults.N=[
      {province:'TP.HCM',date:'2026-10-26',pr:{g7:['999']}},
      {province:'Đồng Tháp',date:'2026-10-26',pr:{g7:['122']}}
    ];
    const result=vm.runInContext('scanRow('+JSON.stringify(row)+')',ctx);
    assert.equal(result.length,1);
    assert.equal(result[0].province,'Đồng Tháp');
    assert.match(result[0].detail,/122/);
  } finally {ctx.lotteryResults.N=original;}
});

test('single-station DAO BL also routes through standard bao matching',()=>{
  const row={...parse('2dmn\n221bdao1.','2026-10-26').rows[0],cross2:false};
  const result=vm.runInContext('scanRow('+JSON.stringify(row)+')',ctx);
  assert.equal(result.length,1);
  assert.match(result[0].detail,/122/);
});

test('DAO BL winner is paid at the matching Bao 3 rate, not zero',()=>{
  const row=parse('2dmn\n221bdao1.','2026-10-26').rows[0];
  const result=vm.runInContext('calcWinning(['+JSON.stringify(row)+'],{b2:75,b3:640,b4:5200})',ctx);
  assert.equal(result.details[0].hits.length,1);
  assert.equal(result.details[0].payout,640);
  assert.equal(result.wins,640);
});
