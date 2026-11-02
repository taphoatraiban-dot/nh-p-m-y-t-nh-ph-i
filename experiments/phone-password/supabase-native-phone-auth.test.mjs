import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativePhoneAuth} from './supabase-native-phone-auth.mjs';
test('staging gate denies by default',()=>{
 assert.throws(()=>createNativePhoneAuth({supabase:{auth:{}}}),/STAGING_ONLY/);
});
test('native phone sign-in returns Supabase session, not local session',async()=>{
 const auth=createNativePhoneAuth({allowStaging:true,supabase:{auth:{
  signUp:async()=>({data:{user:{id:'u1'},session:null},error:null}),
  signInWithPassword:async()=>({data:{user:{id:'u1'},session:{access_token:'supabase-token'}},error:null})
 }}});
 assert.equal((await auth.register('0912345678','safe-password-2026!')).phoneVerified,false);
 assert.equal((await auth.login('0912345678','safe-password-2026!')).session.access_token,'supabase-token');
});
test('login errors fail closed',async()=>{
 const auth=createNativePhoneAuth({allowStaging:true,supabase:{auth:{
  signUp:async()=>({data:null,error:Error('fail')}),
  signInWithPassword:async()=>({data:null,error:Error('fail')})
 }}});
 await assert.rejects(()=>auth.login('0912345678','safe-password-2026!'),/INVALID_CREDENTIALS/);
});
