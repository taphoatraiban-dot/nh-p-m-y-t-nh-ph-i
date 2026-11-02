import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalAdminIntegration} from './local-admin-integration.mjs';
const id='123e4567-e89b-42d3-a456-426614174000';
const accountId='c2345678-e89b-42d3-a456-426614174000';
const request=(method,url,body)=>({method,url,body,headers:{authorization:'Bearer '+'a'.repeat(32)}});
function setup({member=true,csrf=true}={}){
 const calls=[];
 const authClient={auth:{getUser:async()=>({data:{user:{id}},error:null})}};
 const adminDb={from:()=>({select:()=>({eq:()=>({limit:async()=>({data:member?[{user_id:id}]:[],error:null})})})})};
 const store={listPending:async()=>[{id:accountId}],applyAction:async args=>{calls.push(args);return {status:'approved'}}};
 return {handle:createLocalAdminIntegration({store,authClient,adminDb,verifyCsrf:async()=>csrf}),calls};
}
test('requires all trusted dependencies',()=>assert.throws(()=>createLocalAdminIntegration({}),/ADMIN_INTEGRATION_SECURITY_REQUIRED/));
test('denies non-admin before reading pending',async()=>{const {handle}=setup({member:false});assert.equal((await handle(request('GET','/admin/phone/pending'))).status,403)});
test('verified admin can list pending',async()=>{const {handle}=setup();assert.equal((await handle(request('GET','/admin/phone/pending'))).body.accounts.length,1)});
test('CSRF denies writes even for admin',async()=>{const {handle,calls}=setup({csrf:false});assert.equal((await handle(request('POST','/admin/phone/grants',{accountId,action:'approve',term:'1m'}))).status,403);assert.equal(calls.length,0)});
test('verified admin and CSRF can submit valid action',async()=>{const {handle,calls}=setup();assert.equal((await handle(request('POST','/admin/phone/grants',{accountId,action:'approve',term:'1m'}))).status,200);assert.equal(calls[0].admin.id,id)});
