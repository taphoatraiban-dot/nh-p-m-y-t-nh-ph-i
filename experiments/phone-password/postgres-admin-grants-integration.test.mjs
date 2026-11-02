// Real LOCAL PostgreSQL integration test. Requires the private schema + access-grants migration.
// Uses a disposable account and deletes it in finally; never run against production.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createPostgresAdminGrantsStore} from './postgres-admin-grants-store.mjs';
import {evaluatePhoneAccess} from './access-policy.mjs';
const url=process.env.PHONE_AUTH_TEST_DATABASE_URL;
test('real PostgreSQL: pending -> approve -> revoke (LOCAL only)',{skip:!url?'PHONE_AUTH_TEST_DATABASE_URL not set':false},async()=>{
 const parsed=new URL(url);
 if (!['127.0.0.1','localhost','::1'].includes(parsed.hostname)) throw new Error('LOCAL_DB_REQUIRED');
 const {Pool}=createRequire(import.meta.url)('pg');
 const pool=new Pool({connectionString:url,max:2});
 const id=randomUUID();
 const phone='+849'+String(Math.floor(Math.random()*1e8)).padStart(8,'0');
 const admin={id:'local-test-admin',role:'owner',authenticated:true};
 const store=createPostgresAdminGrantsStore(pool);
 try{
  await pool.query('insert into phone_auth_private.accounts(id,phone_e164,password_hash) values ($1,$2,$3)',[id,phone,'scrypt$16384$8$1$test-placeholder']);
  const pending=await store.listPending();
  assert.ok(pending.some(row=>row.id===id),'new account appears in pending list');
  const approved=await store.applyAction({admin,accountId:id,action:'approve',term:'1m'});
  assert.equal(approved.status,'approved');
  const grant=(await pool.query('select * from phone_auth_private.access_grants where account_id=$1',[id])).rows[0];
  assert.equal(evaluatePhoneAccess({identity:{accountId:id,scope:'phone-auth-experiment-only'},grant}).allowed,true);
  const firstAudit=(await pool.query('select actor_id,action,term,previous_status,new_status from phone_auth_private.grant_audit where account_id=$1 order by id',[id])).rows;
  assert.equal(firstAudit.length,1);
  assert.deepEqual(firstAudit[0],{actor_id:'local-test-admin',action:'approve',term:'1m',previous_status:'pending',new_status:'approved'});
  const revoked=await store.applyAction({admin,accountId:id,action:'revoke'});
  assert.equal(revoked.status,'denied');
  const after=(await pool.query('select * from phone_auth_private.access_grants where account_id=$1',[id])).rows[0];
  assert.equal(evaluatePhoneAccess({identity:{accountId:id,scope:'phone-auth-experiment-only'},grant:after}).allowed,false);
  const audit=(await pool.query('select action,previous_status,new_status from phone_auth_private.grant_audit where account_id=$1 order by id',[id])).rows;
  assert.deepEqual(audit.map(x=>x.action),['approve','revoke']);
  assert.equal(audit[1].previous_status,'approved');
  assert.equal(audit[1].new_status,'denied');
 }finally{
  await pool.query('delete from phone_auth_private.accounts where id=$1',[id]);
  await pool.end();
 }
});
