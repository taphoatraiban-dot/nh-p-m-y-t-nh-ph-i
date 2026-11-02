import test from 'node:test';
import assert from 'node:assert/strict';
import {registerWithVerifiedEmailAndPhone} from './registration-adapter.mjs';

const valid={email:'Example@gmail.com',phone:'0912 345 678',password:'secure-passphrase-2026',confirmPassword:'secure-passphrase-2026'};
test('registers using existing email flow without granting a license',async()=>{
 let args;
 const client={auth:{signUp:async input=>{args=input;return {data:{user:{id:'test'},session:null},error:null};}}};
 const result=await registerWithVerifiedEmailAndPhone(client,valid);
 assert.equal(args.email,'example@gmail.com');
 assert.equal(args.options.data.phone_contact_unverified,'+84912345678');
 assert.equal(args.password,valid.password);
 assert.deepEqual(result,{emailConfirmationRequired:true,phoneVerified:false,licenseGranted:false,registrationRequestAccepted:true});
});
test('rejects invalid input before calling remote auth',async()=>{
 let calls=0;
 const client={auth:{signUp:async()=>{calls++;return {data:{session:null},error:null};}}};
 for(const override of [{email:'other@example.com'},{phone:'123'},{password:'short'},{confirmPassword:'different'}]){
  await assert.rejects(registerWithVerifiedEmailAndPhone(client,{...valid,...override}));
 }
 assert.equal(calls,0);
});
test('propagates authentication errors without creating permissions',async()=>{
 const client={auth:{signUp:async()=>({data:null,error:{message:'Registration disabled'}})}};
 await assert.rejects(registerWithVerifiedEmailAndPhone(client,valid),/Registration disabled/);
});

test('same public result for new or obfuscated existing email',async()=>{
 const outcomes=[{data:{user:{id:'new'},session:{access_token:'test'}},error:null},{data:{user:{id:'obfuscated'},session:null},error:null}];
 const results=[];
 for(const response of outcomes){
  const client={auth:{signUp:async()=>response}};
  results.push(await registerWithVerifiedEmailAndPhone(client,valid));
 }
 assert.deepEqual(results[0],results[1]);
 assert.equal(results[0].registrationRequestAccepted,true);
 assert.equal(results[0].phoneVerified,false);
});
