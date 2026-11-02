import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabasePhoneAccountGate} from './supabase-phone-account-gate.mjs';
const db={from:()=>({select:()=>({eq:()=>({limit:async()=>({data:[{id:'u1'}],error:null})})})})};
const authClient={auth:{getUser:async()=>({data:{user:{id:'u1'}},error:null})}};
test('approved verified user passes',async()=>{
 const check=createSupabasePhoneAccountGate({authClient,profileDb:db,approvedAccess:async id=>id==='u1'});
 assert.deepEqual(await check('token'),{allowed:true,reason:'APPROVED',userId:'u1'});
});
test('new phone user without approval denied',async()=>{
 const check=createSupabasePhoneAccountGate({authClient,profileDb:db,approvedAccess:async()=>false});
 assert.equal((await check('token')).reason,'ADMIN_APPROVAL_REQUIRED');
});
test('missing profile and verification failure denied',async()=>{
 const noProfile={from:()=>({select:()=>({eq:()=>({limit:async()=>({data:[],error:null})})})})};
 const check=createSupabasePhoneAccountGate({authClient,profileDb:noProfile,approvedAccess:async()=>true});
 assert.equal((await check('token')).allowed,false);
 const bad=createSupabasePhoneAccountGate({authClient:{auth:{getUser:async()=>{throw Error('offline')}}},profileDb:db,approvedAccess:async()=>true});
 assert.equal((await bad('token')).allowed,false);
});
