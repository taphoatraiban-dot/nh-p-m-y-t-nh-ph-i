import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateQrPayout} from '../qr-payout-preview.mjs';
const rates={b2:75,b3:650,b4:5500,xc:650,dd:75,da2:550,dathang:730,daMB:650};
const row=(type,extra={})=>({type,points:2,region:'N',numbers:['12','34'],...extra});
const matches=(count)=>({supported:true,diagnosticOnly:true,matches:[{number:'12',count}]});
test('bao2 2 hits pays rate times points times hits',()=>{
 const r=calculateQrPayout([row('B2')],[matches(2)],rates);
 assert.equal(r.ready,true);assert.equal(r.total,300);
});
test('zero matches yields zero only with supported diagnostics',()=>{
 const r=calculateQrPayout([row('XC',{numbers:['123']})],[matches(0)],rates);
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

test('empty receipt is not a confirmed zero payout',()=>assert.equal(calculateQrPayout([],[],rates).ready,false));
test('zero points rejected',()=>assert.equal(calculateQrPayout([row('B2',{points:0})],[matches(1)],rates).ready,false));
test('non-integer count rejected',()=>assert.equal(calculateQrPayout([row('B2')],[matches(0.5)],rates).ready,false));
test('overflowed payout rejected',()=>assert.equal(calculateQrPayout([row('B2',{points:1e15})],[matches(999999)],rates).ready,false));
test('unverified diagnostic cannot be used to pay',()=>assert.equal(calculateQrPayout([row('B2')],[{supported:true,matches:[{count:1}]}],rates).ready,false));

test('missing bet numbers blocks payout',()=>assert.equal(calculateQrPayout([row('B2',{numbers:[]})],[matches(1)],rates).ready,false));

test('DA requires two numbers',()=>assert.equal(calculateQrPayout([row('DA',{numbers:['12']})],[{supported:true,diagnosticOnly:true,pairs:[{times:1}]}],rates).ready,false));

test('invalid 2-digit number rejected',()=>assert.equal(calculateQrPayout([row('B2',{numbers:['123']})],[matches(1)],rates).ready,false));
test('invalid XC number rejected',()=>assert.equal(calculateQrPayout([row('XC',{numbers:['12']})],[matches(1)],rates).ready,false));
test('invalid 4-digit number rejected',()=>assert.equal(calculateQrPayout([row('B4',{numbers:['123']})],[matches(1)],rates).ready,false));
test('DA mode mismatch rejected',()=>assert.equal(calculateQrPayout([row('DA',{cross2:true})],[{supported:true,diagnosticOnly:true,cross:false,pairs:[{times:1}]}],rates).ready,false));
test('matching DA cross mode accepted',()=>assert.equal(calculateQrPayout([row('DA',{cross2:true})],[{supported:true,diagnosticOnly:true,cross:true,pairs:[{times:1}]}],rates).total,1100));

test('nested frozen tra payout rates are accepted',()=>assert.equal(calculateQrPayout([row('B2')],[matches(1)],{tra:rates}).total,150));
test('nested frozen payout rates are accepted',()=>assert.equal(calculateQrPayout([row('B2')],[matches(1)],{payout:rates}).total,150));
test('no fallback to current price when nested rate missing',()=>assert.equal(calculateQrPayout([row('B2')],[matches(1)],{tra:{},b2:75}).ready,false));

test('missing count must not be interpreted as zero',()=>assert.equal(calculateQrPayout([row('B2')],[{supported:true,diagnosticOnly:true,matches:[{number:'12'}]}],rates).ready,false));
test('null count must not be interpreted as zero',()=>assert.equal(calculateQrPayout([row('B2')],[{supported:true,diagnosticOnly:true,matches:[{number:'12',count:null}]}],rates).ready,false));
test('string count must not be interpreted as a verified number',()=>assert.equal(calculateQrPayout([row('B2')],[{supported:true,diagnosticOnly:true,matches:[{number:'12',count:'1'}]}],rates).ready,false));
