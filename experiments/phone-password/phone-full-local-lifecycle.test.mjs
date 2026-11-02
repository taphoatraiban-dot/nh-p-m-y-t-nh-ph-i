// Full LOCAL PostgreSQL lifecycle. Refuses remote databases. Never use production.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {createPhoneAuthService} from './phone-auth-service.mjs';
import {createPostgresPhoneStore} from './postgres-phone-store.mjs';
import {createPostgresAdminGrantsStore} from './postgres-admin-grants-store.mjs';
import {createPhoneAccessGate} from './phone-access-gate.mjs';
const connectionString=process.env.PHONE_AUTH_TEST_DATABASE_URL;
test('LOCAL: register -> login -> pending -> approve -> revoke -> logout', {skip:!connectionString&&'Set local test DB URL'},async t=>{
 const u=new URL(connectionString);
 if(u.protocol!=='postgresql:'&&u.protocol!=='postgres:')throw Error('LOCAL_DB_REQUIRED');
 if(!['localhost','127.0.0.1','::1'].includes(u.hostname))throw Error('LOCAL_DB_REQUIRED');
 const {Pool}=createRequire(import.meta.url)('pg');
 const pool=new Pool({connectionString,max:2,connectionTimeoutMillis:3000});
 t.after(async()=>pool.end());
 const auth=createPhoneAuthService({store:createPostgresPhoneStore(pool),limiter:{consume:async()=>true}});
 const grants=createPostgresAdminGrantsStore(pool);
 const admin={id:'local-test-admin',role:'owner',authenticated:true};
 const phone='+849'+String(randomBytes(4).readUInt32BE()%100000000).padStart(8,'0');
 let accountId,token;
 try{
  const registration=await auth.register({phone,password:'Local-test-password-2026!',clientKey:'local'});
  accountId=registration.accountId;
  assert.equal(registration.phoneVerified,false);
  const login=await auth.login({phone,password:'Local-test-password-2026!',clientKey:'local'});
  token=login.token;
  const gate=createPhoneAccessGate({
   authService:auth,
   findGrant:async id=>(await pool.query('select * from phone_auth_private.access_grants where account_id=$1',[id])).rows[0]??null
  });
  assert.equal((await gate(token)).allowed,false);
  assert.ok((await grants.listPending()).some(x=>x.id===accountId));
  await grants.applyAction({admin,accountId,action:'approve',term:'1m'});
  assert.equal((await gate(token)).allowed,true);
  await grants.applyAction({admin,accountId,action:'revoke'});
  assert.equal((await gate(token)).allowed,false);
  const audit=(await pool.query('select action from phone_auth_private.grant_audit where account_id=$1 order by id',[accountId])).rows;
  assert.deepEqual(audit.map(x=>x.action),['approve','revoke']);
  await auth.logout(token);
  assert.equal((await gate(token)).allowed,false);
 }finally{
  if(accountId)await pool.query('delete from phone_auth_private.accounts where id=$1',[accountId]);
 }
});
