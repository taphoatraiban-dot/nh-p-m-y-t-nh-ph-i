import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPhoneSessionForCuncun,requireSupabaseUser} from './phone-supabase-compatibility.mjs';
test('local phone session cannot bypass production RLS',()=>{
 assert.deepEqual(classifyPhoneSessionForCuncun({accountId:'a',scope:'phone-auth-experiment-only'}),{compatible:false,reason:'SUPABASE_AUTH_SESSION_REQUIRED'});
});
test('Supabase verified user accepted and failures denied',async()=>{
 assert.deepEqual(await requireSupabaseUser({authClient:{auth:{getUser:async()=>({data:{user:{id:'verified-id'}},error:null})}},accessToken:'test'}),{authenticated:true,userId:'verified-id'});
 assert.equal((await requireSupabaseUser({authClient:{auth:{getUser:async()=>{throw Error('offline')}}},accessToken:'test'})).authenticated,false);
});
