const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
test('Postgres PIN lockout, ticket expiry, service-only access, and outbox claim',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema auth; create schema extensions;create role anon;create role authenticated;create role service_role bypassrls;
 create table auth.users(id uuid primary key);create table public.telegram_member_groups(user_id uuid,chat_id bigint,primary key(user_id,chat_id));
 -- pgcrypto is not bundled by WASM Postgres; these deterministic stubs test SQL control flow only.
 create function extensions.gen_salt(text,integer) returns text language sql as $$ select 'test-salt'::text $$;
 create function extensions.crypt(text,text) returns text language sql as $$ select md5($1) $$;`);
 const file=fs.readdirSync(path.join(__dirname,'../../supabase/migrations')).find(f=>f.endsWith('_telegram_chat_experiment.sql'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../../supabase/migrations',file),'utf8').replace('create extension if not exists pgcrypto with schema extensions;',''));
 const u='11111111-1111-4111-8111-111111111111';await db.query('insert into auth.users values($1)',[u]);
 const unlock=async(pin,create=false)=>(await db.query('select public.telegram_chat_unlock($1,$2,$3,$4) r',[u,pin,'a'.repeat(64),create])).rows[0].r;
 assert.equal((await unlock('123',true)).success,false);assert.equal((await unlock('1234',true)).success,true);
 for(let i=0;i<5;i++)assert.equal((await unlock('9999')).success,false);
 assert.equal((await unlock('1234')).success,false);
 await db.query("update public.telegram_chat_pins set blocked_until=now()-interval '1 minute' where user_id=$1",[u]);assert.equal((await unlock('1234')).success,true);
 const r=(await db.query('select * from public.telegram_chat_pins')).rows[0];assert.equal(r.failures,0);assert(Date.parse(r.expires_at)>Date.now());
 await db.exec('set role anon');await assert.rejects(db.query('select * from public.telegram_chat_pins'));await assert.rejects(db.query("select public.telegram_chat_claim('11111111-1111-4111-8111-111111111111')"));await db.exec('reset role');
 await db.query('insert into public.telegram_chat_access(user_id,enabled) values($1,true)',[u]);
 await db.query('insert into public.telegram_member_groups values($1,-123)',[u]);
 await db.query('insert into public.telegram_chat_outbox(id,user_id,chat_id,message_text) values($1,$2,-123,$3)',['22222222-2222-4222-8222-222222222222',u,'hello']);
 assert.equal((await db.query('select * from public.telegram_chat_claim($1)',[u])).rows.length,1);
 assert.equal((await db.query('select * from public.telegram_chat_claim($1)',[u])).rows.length,0);
 assert.equal((await db.query('select * from public.telegram_chat_claim($1)',['33333333-3333-4333-8333-333333333333'])).rows.length,0);
 }finally{await db.close();}
});
