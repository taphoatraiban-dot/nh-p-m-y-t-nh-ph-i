import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminApiHandler} from './admin-api-handler.mjs';
const admin={id:'owner-test',role:'owner',authenticated:true};
function setup(verifyAdmin=async()=>admin,verifyCsrf=async()=>true){
 const calls=[];
 const store={listPending:async()=>[{id:'pending'}],applyAction:async(args)=>{calls.push(args);return {status:'approved'}}};
 return {handle:createAdminApiHandler({store,verifyAdmin,verifyCsrf}),calls};
}
test('rejects phone users without administrator session',async()=>{
 const {handle,calls}=setup(async()=>({id:'phone',role:'user',authenticated:true}));
 const r=await handle({method:'POST',url:'/admin/phone/grants',body:{action:'approve',accountId:'id',term:'1m'}});
 assert.equal(r.status,403);assert.equal(calls.length,0);
});
test('rejects missing CSRF verification on writes',async()=>{
 const {handle,calls}=setup(undefined,async()=>false);
 const r=await handle({method:'POST',url:'/admin/phone/grants',body:{action:'approve',accountId:'id',term:'1m'}});
 assert.equal(r.status,403);assert.equal(calls.length,0);
});
test('authenticated admin can list pending accounts',async()=>{
 const {handle}=setup();const r=await handle({method:'GET',url:'/admin/phone/pending'});
 assert.equal(r.status,200);assert.equal(r.body.accounts.length,1);
});
test('admin action is forwarded only after validation',async()=>{
 const {handle,calls}=setup();
 assert.equal((await handle({method:'POST',url:'/admin/phone/grants',body:{accountId:'id',action:'approve',term:'1m'}})).status,200);
 assert.equal(calls[0].admin.id,'owner-test');
 assert.equal((await handle({method:'POST',url:'/admin/phone/grants',body:{accountId:'id',action:'approve',term:'bad'}})).status,400);
 assert.equal(calls.length,1);
});
test('fails closed when security dependencies are missing',()=>{
 assert.throws(()=>createAdminApiHandler({store:{}}),/SECURITY_DEPENDENCIES_REQUIRED/);
});
