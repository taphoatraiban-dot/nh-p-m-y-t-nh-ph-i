import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateQrPayout} from '../qr-payout-preview.mjs';
const rates={b2:75,b3:650,b4:5500,xc:650,dd:75,da2:550,dathang:730,daMB:650};
const row=(type,extra={})=>({type,points:2,region:'N',...extra});
const matches=(count)=>({supported:true,diagnosticOnly:true,matches:[{number:'12',count}]});
test('bao2 2 hits pays rate times points times hits',()=>{
 const r=calculateQrPayout([row('B2')],[matches(2)],rates);
 assert.equal(r.ready,true);assert.equal(r.total,300);
});
test('zero matches yields zero only with supported diagnostics',()=>{
 const r=calculateQrPayout([row('XC')],[matches(0)],rates);
 assert.equal(r.ready,true);assert.equal(r.total,0);
});
test('DA straight pays pair occurrences',()=>{
 const r=calculateQrPayout([row('DA')],[{supported:true,diagnosticOnly:true,pairs:[{a:'12',b:'34',times:2}]}],rates);
 assert.equal(r.total,2920);
});
test('DA cross uses cross rate',()=>{
 const r=calculateQrPayout([row('DA',{cross2:true})],[{supported:true,diagnosticOnly:true,pairs:[{times:1}]}],rates);
 assert.equal(r.total,1100);
});
test('unsupported type never returns a payout',()=>assert.equal(calculateQrPayout([row('DAO XC')],[matches(1)],rates).ready,false));
test('missing diagnostic never returns zero',()=>assert.equal(calculateQrPayout([row('B2')],[],rates).ready,false));
test('missing frozen rate fails closed',()=>assert.equal(calculateQrPayout([row('B2')],[matches(1)],{}).ready,false));
test('negative matches rejected',()=>assert.equal(calculateQrPayout([row('B2')],[matches(-1)],rates).ready,false));
test('hidden row ignored',()=>assert.equal(calculateQrPayout([row('DAO XC',{hidden:true})],[],rates).total,0));
