import test from 'node:test';
import assert from 'node:assert/strict';
import {computeExpiry,planGrantChange} from './admin-grants-core.mjs';
const admin={id:'owner-local',authenticated:true,role:'owner'};
const accountId='123e4567-e89b-42d3-a456-426614174000';
const now=new Date('2026-11-02T00:00:00Z');
test('only authenticated owner/admin can approve',()=>{
 for(const a of [null,{...admin,authenticated:false},{...admin,role:'user'}])
  assert.throws(()=>planGrantChange({admin:a,accountId,action:'approve',term:'1m',now}),/ADMIN_REQUIRED/);
});
test('month-end calendar calculation',()=>{
 assert.equal(computeExpiry('1m',new Date('2026-01-31T00:00:00Z')),'2026-02-28T00:00:00.000Z');
});
test('approval extends from existing future expiry',()=>{
 const result=planGrantChange({admin,accountId,action:'approve',term:'3m',now,previous:{status:'approved',expires_at:'2026-12-02T00:00:00Z'}});
 assert.equal(result.expires_at,'2027-03-02T00:00:00.000Z');
});
test('deny and revoke never approve',()=>{
 for(const action of ['deny','revoke']) assert.equal(planGrantChange({admin,accountId,action,now}).status,'denied');
});
test('permanent grant explicitly has null expiry',()=>{
 assert.equal(planGrantChange({admin,accountId,action:'approve',term:'permanent',now}).expires_at,null);
});
