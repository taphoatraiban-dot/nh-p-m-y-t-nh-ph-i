import test from 'node:test';
import assert from 'node:assert/strict';
import {registerPhonePassword,loginPhonePassword} from './phone-password-adapter.mjs';

// Opt-in E2E test: starts ONLY with explicit local Auth endpoint and test credentials.
// Never use real customer numbers. Do not set LOCAL_PHONE_E2E in production CI.
const endpoint=process.env.LOCAL_PHONE_E2E_URL;
const enabled=process.env.LOCAL_PHONE_E2E==='1';
test('local Supabase Auth phone/password smoke test', {skip:!enabled}, async()=>{
  assert.ok(endpoint,'Set LOCAL_PHONE_E2E_URL to a local Supabase Auth URL');
  const url=new URL(endpoint);
  assert.ok(['localhost','127.0.0.1','::1'].includes(url.hostname),'Local URL required');
  const anonKey=process.env.LOCAL_SUPABASE_ANON_KEY;
  assert.ok(anonKey,'Local publishable/anon key required');
  const phone=process.env.LOCAL_PHONE_E2E_NUMBER;
  const password=process.env.LOCAL_PHONE_E2E_PASSWORD;
  assert.ok(phone&&password,'Set disposable test phone and password');
  const request=async(path,body)=>{
    const response=await fetch(new URL(path,url.origin),{
      method:'POST',
      headers:{apikey:anonKey,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const json=await response.json();
    return {data:response.ok?json:null,error:response.ok?null:json};
  };
  const client={auth:{
    url:endpoint,
    signUp:({phone,password})=>request('/auth/v1/signup',{phone,password}),
    signInWithPassword:({phone,password})=>request('/auth/v1/token?grant_type=password',{phone,password})
      .then(({data,error})=>({data:data?{session:data}:null,error}))
  }};
  const config={environment:'local-test',phoneConfirmationDisabled:true};
  const registration=await registerPhonePassword(client,{phone,password,confirmPassword:password},config);
  assert.equal(registration.licenseGranted,false);
  const login=await loginPhonePassword(client,{phone,password},config);
  assert.ok(login.session.access_token,'Local sign-in must return a token');
});
