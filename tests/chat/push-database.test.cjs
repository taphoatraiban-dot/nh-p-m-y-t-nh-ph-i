const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
test('push queue isolates accounts, excludes history/outgoing/hidden messages and stops when disabled',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role bypassrls;
 create table auth.users(id uuid primary key);
 create table public.telegram_chat_access(user_id uuid primary key,enabled boolean);
 create table public.telegram_member_groups(user_id uuid,chat_id bigint,enabled boolean,primary key(user_id,chat_id));
 create table public.telegram_member_messages(user_id uuid,chat_id bigint,message_id bigint,message_text text,sender_name text,message_date timestamptz,received_at timestamptz,unique(user_id,chat_id,message_id));
 create table public.telegram_member_hidden(user_id uuid,chat_id bigint,message_id bigint,primary key(user_id,chat_id,message_id));`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261109104825_telegram_background_push.sql'),'utf8'));
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 for(const u of [a,b]){await db.query('insert into auth.users values($1)',[u]);await db.query('insert into telegram_chat_access values($1,true)',[u]);await db.query('insert into telegram_member_groups values($1,-123,true)',[u]);}
 const sub=(await db.query("insert into telegram_push_subscriptions(user_id,endpoint,p256dh,auth_key,enabled_since) values($1,'https://fcm.googleapis.com/fake','key','auth',now()-interval '1 minute') returning id",[a])).rows[0].id;
 const msg=async(u,id,sender='',old=false)=>db.query("insert into telegram_member_messages values($1,-123,$2,'private test text',$3,now()-($4::int*interval '1 hour'),now()-($4::int*interval '1 hour'))",[u,id,sender,old?1:0]);
 await msg(a,1);await msg(b,2);await msg(a,3,'Đã gửi');await msg(a,4);await msg(a,5,'',true);await db.query('insert into telegram_member_hidden values($1,-123,4)',[a]);
 let jobs=(await db.query('select * from telegram_push_claim()')).rows;assert.equal(jobs.length,1);assert.equal(jobs[0].subscription_id,sub);assert(!('message_text' in jobs[0]));
 assert.equal((await db.query('select * from telegram_push_claim()')).rows.length,0);
 await db.query("update telegram_push_deliveries set state='sent'");assert.equal((await db.query('select * from telegram_push_claim()')).rows.length,0);
 await db.query('update telegram_push_subscriptions set enabled=false');await msg(a,6);assert.equal((await db.query('select * from telegram_push_claim()')).rows.length,0);
 await db.exec('set role anon');await assert.rejects(db.query('select * from telegram_push_subscriptions'));await assert.rejects(db.query('select * from telegram_push_claim()'));await db.exec('reset role');
 }finally{await db.close();}
});
