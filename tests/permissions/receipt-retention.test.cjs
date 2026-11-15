'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
test('archive migration retains settled records, preserves owner RLS and can be applied twice',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role authenticated;create table public.receipt_verifications(id bigint primary key,owner_user_id text,status text,paid_amount_vnd bigint,receipt_snapshot jsonb);
  alter table public.receipt_verifications enable row level security;
  create policy owner_access on public.receipt_verifications to authenticated using(owner_user_id=current_setting('test.owner',true)) with check(owner_user_id=current_setting('test.owner',true));
  grant select,update,delete on public.receipt_verifications to authenticated;
  insert into public.receipt_verifications values(1,'a','redeemed',12345,'{"private":"a"}'),(2,'b','redeemed',67890,'{"private":"b"}'),(3,'a','active',null,'{}');`);
  const dir=path.join(__dirname,'../../supabase/migrations');const sql=fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(n=>n.endsWith('_receipt_archive_retention.sql'))),'utf8');
  await db.exec(sql);await db.exec(sql);
  await db.exec("set role authenticated;set test.owner='a'");
  await db.exec("update public.receipt_verifications set archived_at=now() where id in (1,2)");
  assert.equal((await db.query('select * from public.receipt_verifications where archived_at is not null')).rows.length,1);
  await assert.rejects(db.exec('delete from public.receipt_verifications where id=1'),e=>e.code==='23514');
  await assert.rejects(db.exec("update public.receipt_verifications set status='active' where id=1"),e=>e.code==='23514');
  await assert.rejects(db.exec('update public.receipt_verifications set paid_amount_vnd=0 where id=1'),e=>e.code==='23514');
  await db.exec('update public.receipt_verifications set archived_at=null where id=1');
  const paid=(await db.query('select * from public.receipt_verifications where id=1')).rows[0];assert.equal(Number(paid.paid_amount_vnd),12345);assert.equal(paid.status,'redeemed');assert.deepEqual(paid.receipt_snapshot,{private:'a'});
  await db.exec('delete from public.receipt_verifications where id=3');
  await db.exec('reset role');const foreign=(await db.query('select * from public.receipt_verifications where id=2')).rows[0];assert.equal(foreign.archived_at,null);assert.equal(Number(foreign.paid_amount_vnd),67890);
 }finally{await db.close();}
});
