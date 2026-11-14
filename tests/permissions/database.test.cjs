const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'../..');
const ids=Array.from({length:8},(_,i)=>`00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`);
test('server permission matrix and downgrade',async t=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
 create table public.profiles(id uuid primary key,role text,edition text default 'standard');
 create table public.admin_users(user_id uuid primary key);
 create table public.devices(user_id uuid,device_id text,device_name text,active boolean,first_seen timestamptz,last_seen timestamptz);
 create table public.email_licenses(user_id uuid,active boolean,expires_at timestamptz);
 create table public.phone_auth_accounts(user_id uuid,status text,phone_e164 text);
 create table public.licenses(user_id uuid,active boolean,expires_at timestamptz);
 grant select on public.profiles to authenticated;
 grant all on public.admin_users to authenticated,anon;`);
 const migrationDir=path.join(root,'supabase/migrations');
 const editionSQL=fs.readFileSync(path.join(migrationDir,'20261114140000_account_editions.sql'),'utf8');
 await db.exec(editionSQL.slice(editionSQL.indexOf('create or replace function public.admin_list_device_editions')));
 await db.exec(fs.readFileSync(path.join(migrationDir,'20261114150000_device_phone_labels.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(migrationDir,fs.readdirSync(migrationDir).find(n=>n.endsWith('_account_permission_hardening.sql'))),'utf8'));
 for(let i=0;i<ids.length;i++){
  await db.query('insert into auth.users(id,email) values($1,$2)',[ids[i],i===3?'phone-test@accounts.invalid':`fixture${i}@example.invalid`]);
  if(i!==4)await db.query('insert into profiles(id,role,edition) values($1,$2,$3)',[ids[i],[2,5,6].includes(i)?'admin':'user',i===0?'standard':'pro']);
  await db.query("insert into email_licenses values($1,true,now()+interval '1 day')",[ids[i]]);
 }
 await db.query('insert into admin_users values($1),($2)',[ids[2],ids[5]]);
 await db.exec('grant execute on function public.check_email_license() to authenticated;');
 const login=async i=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[i===null?'':ids[i]]);await db.exec('set role authenticated');};
 const report=()=>db.query(`select public.pro_calculation_report('[{"region":"N","type":"Bao 2","numbers":["01","02"],"gross":12.5,"points":1,"win":3,"thu":9.5}]') as result`);
 await t.test('STANDARD denies PRO and Admin APIs',async()=>{await login(0);await assert.rejects(report(),e=>e.code==='42501');for(const name of ['admin_list_device_editions','admin_list_device_phone_numbers'])await assert.rejects(db.query('select '+name+'()'),e=>e.code==='42501');});
 await t.test('PRO report allowed, Admin APIs denied',async()=>{await login(1);const {rows}=await report();assert.equal(rows[0].result.summary[0].gross,12.5);assert.equal(rows[0].result.top10[0].items[0].gross,6.25);await assert.rejects(db.query('select admin_list_devices()'));await assert.rejects(db.query('select admin_set_profile_edition($1,$2)',[ids[1],'pro']),e=>e.code==='42501');});
 await t.test('both original Admin memberships retain access',async()=>{for(const i of [2,5]){await login(i);assert.equal((await db.query('select check_email_license() as r')).rows[0].r.is_admin,true);await report();await db.query('select admin_list_devices()');}});
 await t.test('stale profile admin role grants no Admin access',async()=>{await login(6);assert.equal((await db.query('select check_email_license() as r')).rows[0].r.is_admin,false);await assert.rejects(db.query('select admin_list_devices()'));});
 await t.test('missing profile defaults to STANDARD',async()=>{await login(4);assert.equal((await db.query('select check_email_license() as r')).rows[0].r.edition,'standard');await assert.rejects(report());});
 await t.test('phone identity cannot use email license fallback',async()=>{await login(3);assert.equal((await db.query('select check_email_license() as r')).rows[0].r.active,false);await assert.rejects(report());});
 await t.test('anonymous requests denied',async()=>{await login(null);await assert.rejects(report());await db.exec('set role anon');await assert.rejects(report());});
 await t.test('self-promotion blocked even with future broad profile grants',async()=>{await login(0);await assert.rejects(db.query("update profiles set edition='pro' where id=$1",[ids[0]]));await db.exec('reset role;grant update,insert on profiles to authenticated;');await login(0);await assert.rejects(db.query("update profiles set role='admin',edition='pro' where id=$1",[ids[0]]),e=>e.code==='42501');await assert.rejects(db.query("insert into profiles values($1,'admin','pro')",[ids[4]]),e=>e.code==='42501');await assert.rejects(db.query('insert into admin_users values($1)',[ids[0]]),e=>e.code==='42501');});
 await t.test('downgrade applies to next server check without token refresh',async()=>{await login(2);await db.query("select admin_set_profile_edition($1,'standard')",[ids[1]]);await login(1);await assert.rejects(report(),e=>e.code==='42501');await login(2);await db.query("select admin_set_profile_edition($1,'pro')",[ids[1]]);await login(1);await report();});
 await t.test('Admin downgrade and invalid tier rejected',async()=>{await login(2);for(const [id,tier] of [[ids[5],'standard'],[ids[1],'admin']])assert.equal((await db.query('select admin_set_profile_edition($1,$2) r',[id,tier])).rows[0].r.ok,false);});
 await t.test('Admin can set edition for a legitimate account with missing profile',async()=>{await login(2);assert.equal((await db.query("select admin_set_profile_edition($1,'pro') r",[ids[4]])).rows[0].r.ok,true);await login(4);await report();});
 await t.test('malformed report payloads rejected',async()=>{await login(1);for(const payload of [null,{},[{}],[{region:'N',type:'x',numbers:[],gross:1,points:1,win:0,thu:1}]])await assert.rejects(db.query('select pro_calculation_report($1)',[JSON.stringify(payload)]),e=>e.code==='22023');});
 await t.test('aggregation preserves duplicates, floating money, ties and top ten',async()=>{
  await login(1);const input=Array.from({length:48},(_,i)=>({region:i%3===0?'B':'N',type:i%4===0?'XC':'Bao 2',numbers:[String(i%17).padStart(2,'0'),String((i+1)%17).padStart(2,'0')],gross:i%5+.1,points:i%3+.5,win:i%7,thu:i%2?-3.75:4.25}));
  const result=(await db.query('select pro_calculation_report($1) r',[JSON.stringify(input)])).rows[0].r;
  for(const group of result.summary){const rows=input.filter(r=>r.region===group.region&&r.type===group.type);for(const key of ['gross','win','thu'])assert(Math.abs(group[key]-rows.reduce((sum,r)=>sum+r[key],0))<1e-10);}
  for(const group of result.top10){const acc=new Map();for(const r of input.filter(r=>r.region===group.region&&r.type===group.type))for(const n of r.numbers){if(!acc.has(n))acc.set(n,{num:n,gross:0,points:0});acc.get(n).gross+=r.gross/r.numbers.length;acc.get(n).points+=r.points;}
   const expected=[...acc.values()].sort((a,b)=>b.gross-a.gross||b.points-a.points).slice(0,10);assert.deepEqual(group.items.map(x=>x.num),expected.map(x=>x.num));for(let i=0;i<expected.length;i++)assert(Math.abs(group.items[i].gross-expected[i].gross)<1e-10);
  }
 });
 await t.test('license revocation closes PRO API',async()=>{await db.exec('reset role');await db.query('update email_licenses set active=false where user_id=$1',[ids[1]]);await login(1);await assert.rejects(report(),e=>e.code==='42501');});
 }finally{await db.close();}
});
