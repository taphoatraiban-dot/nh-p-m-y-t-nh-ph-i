import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhoneLicenseLookup} from './supabase-phone-license-lookup.mjs';
const id='123e4567-e89b-42d3-a456-426614174000';
const db=row=>({from:name=>{assert.equal(name,'licenses');return {select:()=>({eq:(field,value)=>{assert.equal(field,'user_id');assert.equal(value,id);return {limit:async()=>({data:row?[row]:[],error:null})}}})}}});
test('active unexpired license approved',async()=>{
 const check=createPhoneLicenseLookup({db:db({user_id:id,active:true,expires_at:'2027-01-01T00:00:00Z'}),clock:()=>new Date('2026-11-02T00:00:00Z')});
 assert.equal(await check(id),true);
});
test('expired inactive and absent licenses denied',async()=>{
 for(const row of [{user_id:id,active:false,expires_at:null},{user_id:id,active:true,expires_at:'2020-01-01T00:00:00Z'},null]){
  assert.equal(await createPhoneLicenseLookup({db:db(row)})(id),false);
 }
});
test('invalid UUID and database failures denied',async()=>{
 assert.equal(await createPhoneLicenseLookup({db:db(null)})('phone-only'),false);
 const bad={from:()=>{throw Error('offline')}};
 assert.equal(await createPhoneLicenseLookup({db:bad})(id),false);
});
