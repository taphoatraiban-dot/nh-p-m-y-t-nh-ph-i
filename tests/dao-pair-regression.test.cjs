'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const from=html.indexOf('function splitChainedSameNumbers('),to=html.indexOf('\nfunction ',from+10);
assert.ok(from>=0&&to>from);
const ctx=vm.createContext({});vm.runInContext(html.slice(from,to),ctx);const split=ctx.splitChainedSameNumbers;
test('DAO pair preserves both DAO BL and XDAO',()=>{
 const out=split('636.336bdao1n.xdao10n.');
 for(const token of ['636bdao1n.','336bdao1n.','636xdao10n.','336xdao10n.'])assert.ok(out.includes(token),token+' missing: '+out);
 assert.ok(!out.includes('636b1n.'));
});
test('legacy special mixed pair unchanged',()=>assert.equal(split('568.875bdao0,5.xcdao3.'),'568b0,5. 875bdao0,5. 568xdao3. 875xcdao3.'));
