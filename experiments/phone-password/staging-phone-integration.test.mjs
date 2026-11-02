import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhoneAliasAuth} from './supabase-phone-alias-auth.mjs';
import {createProductionLicenseRpcGate} from './production-license-rpc-gate.mjs';
const secret='local-test-secret-32-characters-minimum';
const id='11111111-1111-4111-8111-111111111111';
const phone='0912345678';
function setup({license={success:true,active:true},userId=id,authError=null}={}){
 const calls=[];
 const auth={signUp:async p=>{calls.push(['signup',p]);return {data:{user:{id}},error:null};},signInWithPassword:async p=>{calls.push(['login',p]);return {data:{user:{id},session:{access_token:'local-token'}},error:null};}};
 const alias=createPhoneAliasAuth({supabase:{auth},aliasSecret:secret,allowStaging:true});
 const gate=createProductionLicenseRpcGate({userClientFactory:async token=>{
  assert.equal(token,'local-token');
  return {auth:{getUser:async()=>({data:{user:{id}},error:authError})},rpc:async name=>{calls.push(['rpc',name]);return {data:license,error:null};}};
 }});
 return {alias,gate,calls};
}
test('register then login verifies license without SMS',async()=>{
 const {alias,gate,calls}=setup();
 const registered=await alias.register(phone,'secure-password-2026');
 const logged=await alias.login('+84912345678','secure-password-2026');
 const permission=await gate({accessToken:logged.session.access_token,expectedUserId:registered.userId});
 assert.equal(permission.allowed,true);
 assert.equal(calls[0][1].email,calls[1][1].email);
 assert.equal(calls[2][1],'check_email_license');
 assert.equal(calls[0][1].phone,undefined);
});
test('registration never automatically grants a license',async()=>{
 const {alias,gate}=setup({license:{success:true,active:false}});
 const registered=await alias.register(phone,'secure-password-2026');
 const logged=await alias.login(phone,'secure-password-2026');
 assert.equal((await gate({accessToken:logged.session.access_token,expectedUserId:registered.userId})).allowed,false);
});
test('rejects identity mismatch before license check',async()=>{
 const {alias,gate,calls}=setup();
 const logged=await alias.login(phone,'secure-password-2026');
 const result=await gate({accessToken:logged.session.access_token,expectedUserId:'22222222-2222-4222-8222-222222222222'});
 assert.equal(result.allowed,false);
 assert.equal(calls.some(x=>x[0]==='rpc'),false);
});
