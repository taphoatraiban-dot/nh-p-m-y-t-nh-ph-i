// LOCAL-only HTTP integration test; no production Supabase credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalAdminHttpBridge} from './local-admin-http-bridge.mjs';
import {createLocalAdminIntegration} from './local-admin-integration.mjs';
const adminId='123e4567-e89b-42d3-a456-426614174000';
const accountId='c2345678-e89b-42d3-a456-426614174000';
test('HTTP -> Supabase verifier -> admin handler -> store, deny-by-default',async()=>{
 let isMember=false,csrfAllowed=false,changes=0;
 const authClient={auth:{getUser:async token=>({data:{user:token==='valid-token-'.padEnd(32,'x')?{id:adminId}:null},error:null})}};
 const adminDb={from:table=>{assert.equal(table,'admin_users');return {select:()=>({eq:()=>({limit:async()=>({data:isMember?[{user_id:adminId}]:[],error:null})})})}}};
 const store={listPending:async()=>[{id:accountId}],applyAction:async()=>{changes++;return {status:'approved'}}};
 const handle=createLocalAdminIntegration({store,authClient,adminDb,verifyCsrf:async req=>csrfAllowed&&req.headers['x-csrf-token']==='test-csrf'});
 const server=createLocalAdminHttpBridge({handle});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const auth='Bearer '+ 'valid-token-'.padEnd(32,'x');
 const post=()=>fetch(base+'/admin/phone/grants',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json','X-CSRF-Token':'test-csrf'},body:JSON.stringify({accountId,action:'approve',term:'1m'})});
 try{
  let r=await fetch(base+'/admin/phone/pending');assert.equal(r.status,403);
  r=await fetch(base+'/admin/phone/pending',{headers:{Authorization:auth}});assert.equal(r.status,403);
  isMember=true;
  r=await fetch(base+'/admin/phone/pending',{headers:{Authorization:auth}});assert.equal(r.status,200);assert.equal((await r.json()).accounts.length,1);
  r=await post();assert.equal(r.status,403);assert.equal(changes,0);
  csrfAllowed=true;r=await post();assert.equal(r.status,200);assert.equal(changes,1);
  r=await fetch(base+'/admin/phone/grants',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json','X-CSRF-Token':'test-csrf'},body:JSON.stringify({accountId:'bad',action:'approve',term:'1m'})});assert.equal(r.status,400);assert.equal(changes,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
