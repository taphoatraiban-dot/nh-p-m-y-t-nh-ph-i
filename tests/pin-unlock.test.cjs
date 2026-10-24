'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('let pinUnlockBusy=false;'),end=html.indexOf('\n$("pinUnlockBtn")',start);
const source=html.slice(start,end);
function pending(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function setup(overrides={}){
 const calls=[];const fields={pinEmail:{value:'demo@example.test'},pinInput:{value:'1234'},pinStatus:{}};
 const c=vm.createContext({authBootEpoch:0,$:id=>fields[id],getSavedPin:()=>'',cloudPinHash:async()=> 'test-hash',tsSha256:async()=> 'test-hash',pinKey:email=>'test:'+email,localStorage:{setItem:()=>calls.push('cache')},checkLicense:async()=>calls.push('license'),claimDevice:async()=>calls.push('device'),showApp:()=>calls.push('app'),showFullLogin:()=>calls.push('password'),loginStatus:()=>calls.push('error'),refreshPinDots:()=>calls.push('dots'),sb:{auth:{signOut:async()=>calls.push('signout')}},...overrides});
 vm.runInContext(source,c);return {c,fields,calls,run:()=>vm.runInContext('unlockByPin()',c),busy:()=>vm.runInContext('pinUnlockBusy',c)};
}
test('cloud PIN lookup is single-flight under repeated submission',async()=>{
 const p=pending();let count=0;const x=setup({cloudPinHash:()=>{count++;return p.promise;}});
 const first=x.run();await x.run();assert.equal(count,1);assert.equal(x.busy(),true);
 p.resolve('test-hash');await first;assert.equal(x.calls.filter(v=>v==='app').length,1);assert.equal(x.busy(),false);
});
test('wrong PIN resets input and allows retry without server grant',async()=>{
 const x=setup({getSavedPin:()=> '9999'});await x.run();assert.equal(x.fields.pinInput.value,'');assert.deepEqual(x.calls,['dots']);assert.equal(x.busy(),false);
 x.fields.pinInput.value='9999';await x.run();assert.ok(x.calls.includes('app'));
});
test('private app waits for both license and device checks',async()=>{
 const a=pending(),b=pending();const x=setup({getSavedPin:()=> '1234',checkLicense:()=>a.promise,claimDevice:()=>b.promise});
 const task=x.run();a.resolve();await Promise.resolve();assert.ok(!x.calls.includes('app'));b.resolve();await task;assert.ok(x.calls.includes('app'));
});
test('signout during a cloud lookup prevents caching or opening',async()=>{
 const p=pending();const x=setup({cloudPinHash:()=>p.promise});const task=x.run();x.c.authBootEpoch++;p.resolve('test-hash');await task;assert.deepEqual(x.calls,[]);assert.equal(x.busy(),false);
});
test('signout during server checks prevents stale reopening',async()=>{
 const p=pending();const x=setup({getSavedPin:()=> '1234',checkLicense:()=>p.promise});const task=x.run();x.c.authBootEpoch++;p.resolve();await task;assert.ok(!x.calls.includes('app'));assert.equal(x.busy(),false);
});
test('server denial stays locked even when signout also fails',async()=>{
 const x=setup({getSavedPin:()=> '1234',checkLicense:async()=>{throw Error('denied');},sb:{auth:{signOut:async()=>{throw Error('offline');}}}});await x.run();assert.ok(!x.calls.includes('app'));assert.ok(x.calls.includes('password'));assert.equal(x.busy(),false);
});
test('cloud PIN hashing failure is handled and clears busy state',async()=>{
 const x=setup({tsSha256:async()=>{throw Error('crypto unavailable');}});await x.run();assert.ok(!x.calls.includes('app'));assert.ok(x.calls.includes('password'));assert.equal(x.busy(),false);
});
test('incomplete PIN never starts remote operations',async()=>{
 const x=setup();x.fields.pinInput.value='12';await x.run();assert.deepEqual(x.calls,[]);assert.equal(x.busy(),false);
});
