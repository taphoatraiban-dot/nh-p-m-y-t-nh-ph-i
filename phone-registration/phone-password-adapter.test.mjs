import test from 'node:test';
import assert from 'node:assert/strict';
import {registerPhonePassword,loginPhonePassword} from './phone-password-adapter.mjs';
const config={environment:'local-test',phoneConfirmationDisabled:true};
const creds={phone:'0912345678',password:'very-long-password',confirmPassword:'very-long-password'};
test('refuses production and missing test flag before any network request',async()=>{
 let called=false;const client={auth:{url:'http://127.0.0.1:54321/auth/v1',signUp:async()=>{called=true;return {error:null}}}};
 await assert.rejects(registerPhonePassword(client,creds,{environment:'production',phoneConfirmationDisabled:true}));
 await assert.rejects(registerPhonePassword(client,creds,{environment:'local-test',phoneConfirmationDisabled:false}));
 assert.equal(called,false);
});
test('signs up with native phone, never creates email or grants license',async()=>{
 let args;const client={auth:{url:'http://127.0.0.1:54321/auth/v1',signUp:async a=>{args=a;return {data:{user:{id:'test'}},error:null}}}};
 const result=await registerPhonePassword(client,creds,config);
 assert.deepEqual(args,{phone:'+84912345678',password:creds.password});
 assert.deepEqual(result,{registrationRequestAccepted:true,phoneVerified:false,licenseGranted:false});
});
test('signs in with normalized phone and returns test session',async()=>{
 const session={access_token:'test-token'};let args;
 const client={auth:{url:'http://127.0.0.1:54321/auth/v1',signInWithPassword:async a=>{args=a;return {data:{session},error:null}}}};
 const result=await loginPhonePassword(client,creds,config);
 assert.deepEqual(args,{phone:'+84912345678',password:creds.password});
 assert.equal(result.session,session);
});
test('failed login does not expose account existence',async()=>{
 const client={auth:{url:'http://127.0.0.1:54321/auth/v1',signInWithPassword:async()=>({data:null,error:{message:'not found'}})}};
 await assert.rejects(loginPhonePassword(client,creds,config),/Số điện thoại hoặc mật khẩu không đúng/);
});

test('blocks production endpoint even if caller labels it local',async()=>{
 let called=false;
 const client={auth:{url:'https://zigpqddlhvjbjrwhfhaa.supabase.co/auth/v1',signUp:async()=>{called=true;return {error:null}}}};
 await assert.rejects(registerPhonePassword(client,creds,config),/Chỉ chạy trong môi trường thử nghiệm/);
 assert.equal(called,false);
});
