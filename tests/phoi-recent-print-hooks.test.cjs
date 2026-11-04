const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/phoi-recent-print-hooks.js'),'utf8');
function load(){
 const ctx={Promise};ctx.globalThis=ctx;vm.runInNewContext(source,ctx);return ctx.CuncunRecentPhoiHooks;
}
test('hooks remain inert until explicitly attached',()=>{
 const hooks=load();
 assert.doesNotThrow(()=>{hooks.saved({id:'p1'});hooks.deleted(['p1']);});
});
test('attached hooks dispatch save and all deletion IDs',async()=>{
 const hooks=load(),events=[];
 hooks.attach({saved:row=>events.push('save:'+row.id),deleted:id=>events.push('delete:'+id)});
 hooks.saved({id:'p1'});hooks.deleted(['p1','p2','',null]);
 await Promise.resolve();
 assert.deepEqual(events,['save:p1','delete:p1','delete:p2']);
 hooks.detach();hooks.deleted('p3');assert.equal(events.length,3);
});
test('backup failures cannot break the print or delete action',async()=>{
 const hooks=load();
 hooks.attach({saved:()=>{throw Error('offline')},deleted:()=>Promise.reject(Error('offline'))});
 assert.doesNotThrow(()=>{hooks.saved({id:'p1'});hooks.deleted('p1')});
 await new Promise(resolve=>setImmediate(resolve));
});
test('real print history contains the opt-in save and deletion integration points',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.match(html,/src\/phoi-recent-print-hooks\.js/);
 assert.match(html,/window\.CuncunRecentPhoiHooks\?\.saved\(x\)/);
 assert.match(html,/window\.CuncunRecentPhoiHooks\?\.deleted\(ids\)/);
});

test('hooks cannot silently replace an already configured backup adapter',()=>{
 const hooks=load();
 const adapter={saved:()=>{},deleted:()=>{}};
 hooks.attach(adapter);
 assert.throws(()=>hooks.attach(adapter),/already attached/);
 hooks.detach();
 assert.doesNotThrow(()=>hooks.attach(adapter));
});

test('diagnostics expose backup failures without interrupting print',async()=>{
 const hooks=load();
 hooks.attach({saved:()=>Promise.reject(Error('network offline')),deleted:()=>{}});
 hooks.saved({id:'p1'});
 await new Promise(resolve=>setImmediate(resolve));
 const status=hooks.diagnostics();
 assert.equal(status.attached,true);
 assert.equal(status.inFlight,0);
 assert.match(status.lastError,/network offline/);
});
