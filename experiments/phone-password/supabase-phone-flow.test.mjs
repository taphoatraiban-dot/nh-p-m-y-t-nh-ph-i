import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabasePhoneFlow} from './supabase-phone-flow.mjs';
const id='123e4567-e89b-42d3-a456-426614174000';
function fixtures({active=true,profile=true,verifiedId=id}={}){
 const supabase={auth:{
  signUp:async()=>({data:{user:{id},session:null},error:null}),
  signInWithPassword:async()=>({data:{user:{id},session:{access_token:'token'}} ,error:null})
 }};
 const serverAuthClient={auth:{getUser:async()=>({data:{user:{id:verifiedId}},error:null})}};
 const serverDb={from:table=>({select:()=>({eq:()=>({limit:async()=>({data:table==='profiles'?(profile?[{id:verifiedId}]:[]):[{user_id:verifiedId,active,expires_at:null}],error:null})})})})};
 return {supabase,serverAuthClient,serverDb,allowStaging:true};
}
test('approved phone login returns verified Supabase session',async()=>{
 const flow=createSupabasePhoneFlow(fixtures());
 const result=await flow.login('0912345678','safe-password-2026!');
 assert.equal(result.allowed,true);
 assert.equal(result.session.access_token,'token');
});
test('inactive license and missing profile cannot get session',async()=>{
 for(const opts of [{active:false},{profile:false}]){
  const result=await createSupabasePhoneFlow(fixtures(opts)).login('0912345678','safe-password-2026!');
  assert.equal(result.allowed,false);
  assert.equal(result.session,null);
 }
});
test('mismatched verified user rejected',async()=>{
 const other='123e4567-e89b-42d3-a456-426614174001';
 const result=await createSupabasePhoneFlow(fixtures({verifiedId:other})).login('0912345678','safe-password-2026!');
 assert.equal(result.allowed,false);
 assert.equal(result.reason,'IDENTITY_MISMATCH');
});
