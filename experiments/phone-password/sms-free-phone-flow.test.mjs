import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhoneAliasAuth} from './supabase-phone-alias-auth.mjs';
import {createSmsFreePhoneFlow} from './sms-free-phone-flow.mjs';
const secret='local-only-secret-at-least-32-characters-12345';
const uuid='11111111-1111-4111-8111-111111111111';
function mockAuth(){
 const calls=[];
 const supabase={auth:{
  async signUp(payload){calls.push(['signup',payload]);return {data:{user:{id:uuid}},error:null};},
  async signInWithPassword(payload){calls.push(['login',payload]);return {data:{user:{id:uuid},session:{access_token:'test-token'}},error:null};}
 }};
 return {supabase,calls};
}
test('SMS-free adapter accepts VN phone, does not call native phone auth',async()=>{
 const {supabase,calls}=mockAuth();
 const auth=createPhoneAliasAuth({supabase,aliasSecret:secret,allowStaging:true});
 const reg=await auth.register('0912 345 678','secure-password-2026');
 const login=await auth.login('+84912345678','secure-password-2026');
 assert.equal(reg.approvalRequired,true);
 assert.equal(login.userId,uuid);
 assert.equal(calls.length,2);
 assert.equal(calls[0][1].email,calls[1][1].email);
 assert.match(calls[0][1].email,/^phone-[0-9a-f]{64}@accounts\.invalid$/);
 assert.equal(calls[0][1].phone,undefined);
});
test('Staging gate and strong alias secret are mandatory',()=>{
 const {supabase}=mockAuth();
 assert.throws(()=>createPhoneAliasAuth({supabase,aliasSecret:secret}),/STAGING_ONLY/);
 assert.throws(()=>createPhoneAliasAuth({supabase,aliasSecret:'weak',allowStaging:true}),/STRONG_ALIAS_SECRET_REQUIRED/);
});
test('Reject malformed phone and weak password',async()=>{
 const {supabase}=mockAuth();
 const auth=createPhoneAliasAuth({supabase,aliasSecret:secret,allowStaging:true});
 await assert.rejects(auth.register('1234','secure-password-2026'));
 await assert.rejects(auth.register('0912345678','123'));
});
function db({active=true,expires_at=null,profile=true}={}){
 return {from(table){return {select(){return {eq(){return {async limit(){return {data:table==='profiles'?(profile?[{id:uuid}]:[]):[{user_id:uuid,active,expires_at}],error:null}}}}}}}}};
}
test('Approved active license allows login',async()=>{
 const {supabase}=mockAuth();
 const flow=createSmsFreePhoneFlow({supabase,serverAuthClient:{auth:{getUser:async()=>({data:{user:{id:uuid}},error:null})}},serverDb:db(),aliasSecret:secret,allowStaging:true});
 const result=await flow.login('0912345678','secure-password-2026');
 assert.equal(result.allowed,true);
});
test('Missing or inactive license denies login and drops session from result',async()=>{
 const {supabase}=mockAuth();
 const flow=createSmsFreePhoneFlow({supabase,serverAuthClient:{auth:{getUser:async()=>({data:{user:{id:uuid}},error:null})}},serverDb:db({active:false}),aliasSecret:secret,allowStaging:true});
 const result=await flow.login('0912345678','secure-password-2026');
 assert.equal(result.allowed,false);
 assert.equal(result.session,null);
});
