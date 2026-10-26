'use strict';
// Integration validation in a disposable, in-memory PostgreSQL WASM instance.
// Run only when PGLITE_MODULE_PATH points to an isolated installation.
// No Supabase credentials, network calls, or production database connections.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = process.env.PGLITE_MODULE_PATH;
const SQL = fs.readFileSync(path.join(__dirname, '../prototypes/sql/admin_customer_command.review_only.sql'), 'utf8');
const OVERVIEW_SQL = fs.readFileSync(path.join(__dirname, '../prototypes/sql/admin_customer_overview.proposal.sql'), 'utf8');
const AUDIT_SQL = fs.readFileSync(path.join(__dirname, '../prototypes/sql/admin_customer_audit.review_only.sql'), 'utf8');
const IDS = Object.freeze({ admin1: '00000000-0000-4000-8000-000000000001', admin2: '00000000-0000-4000-8000-000000000002', customer: '00000000-0000-4000-8000-000000000003' });

test('PostgreSQL transaction, authorization, renewal and archived device reset', { skip: !modulePath && 'Set PGLITE_MODULE_PATH for isolated PostgreSQL execution' }, async () => {
  const { PGlite } = require(modulePath);
  const db = new PGlite();
  const sql = statement => db.query(statement);
  const setActor = async id => { await sql(`select set_config('app.test_uid','${id}',false)`); };
  const request = async (requestId, action, expected, days = null, reason = 'Khách yêu cầu hỗ trợ thử nghiệm') => {
    const args = [requestId, action, IDS.customer, expected, days, reason];
    return db.query('select public.admin_customer_command($1::uuid,$2::text,$3::uuid,$4::bigint,$5::integer,$6::text) as result', args);
  };
  const reqId = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('app.test_uid', true),'')::uuid
      $$;
      create table public.admin_users (user_id uuid primary key references auth.users(id));
      create table public.profiles (id uuid primary key references auth.users(id), role text);
      create table public.email_licenses (user_id uuid primary key references auth.users(id), email text not null,
        expires_at timestamptz not null, active boolean not null default true, updated_at timestamptz not null default now());
      create table public.pending_email_licenses (email text primary key, expires_at timestamptz not null,
        active boolean not null default true);
      create table public.devices (user_id uuid primary key references auth.users(id), device_id text not null,
        device_name text, active boolean not null default true, first_seen timestamptz not null default now(),
        last_seen timestamptz not null default now());
    `);
    for (const id of [IDS.admin1, IDS.admin2, IDS.customer]) {
      await sql(`insert into auth.users(id,email) values ('${id}','fixture@example.invalid')`);
    }
    for (const id of [IDS.admin1, IDS.admin2]) {
      await sql(`insert into public.admin_users(user_id) values ('${id}')`);
      await sql(`insert into public.profiles(id,role) values ('${id}','admin')`);
    }
    await sql(`insert into public.profiles(id,role) values ('${IDS.customer}','user')`);
    await sql(`insert into public.email_licenses(user_id,email,expires_at) values ('${IDS.customer}','customer@example.invalid',now()-interval '6 days')`);
    await sql(`insert into public.devices(user_id,device_id,device_name) values ('${IDS.customer}','old-device','Máy thử nghiệm cũ')`);

    // The actual review file must NOT persist a schema change if run verbatim.
    await db.exec(SQL);
    assert.equal((await sql("select to_regclass('public.admin_customer_commands') as table_name")).rows[0].table_name, null);

    // Explicit isolated rehearsal only: convert the final ROLLBACK in memory.
    const sandboxSql = SQL.replace(/rollback;\s*$/i, 'commit;');
    await db.exec(sandboxSql);
    await db.exec(OVERVIEW_SQL);
    assert.equal((await sql("select to_regprocedure('public.admin_customer_overview()') as function_name")).rows[0].function_name, null);
    await db.exec(OVERVIEW_SQL.replace(/rollback;\s*$/i, 'commit;'));
    await db.exec(AUDIT_SQL);
    assert.equal((await sql("select to_regprocedure('public.admin_customer_audit(uuid,integer)') as function_name")).rows[0].function_name, null);
    await db.exec(AUDIT_SQL.replace(/rollback;\s*$/i, 'commit;'));
    await setActor(IDS.admin1);
    const overview = await sql('select * from public.admin_customer_overview()');
    assert.equal(overview.rows.length, 1);
    assert.equal(overview.rows[0].user_id, IDS.customer);
    assert.equal(Number(overview.rows[0].revision), 0);
    const extended = await request(reqId(1), 'extend', 0, 30);
    assert.equal(extended.rows[0].result.success, true);
    assert.equal(extended.rows[0].result.revision, 1);
    assert.equal(Number((await sql('select revision from public.admin_customer_overview()')).rows[0].revision), 1);
    const expiry = new Date((await sql(`select expires_at from public.email_licenses where user_id='${IDS.customer}'`)).rows[0].expires_at);
    const diff = expiry.getTime() - Date.now();
    assert.ok(diff > 29 * 86400000 && diff <= 31 * 86400000);

    // The same request ID must not grant extra time.
    const again = await request(reqId(1), 'extend', 0, 30);
    assert.equal(again.rows[0].result.revision, 1);
    const expiryAgain = new Date((await sql(`select expires_at from public.email_licenses where user_id='${IDS.customer}'`)).rows[0].expires_at);
    assert.equal(expiryAgain.getTime(), expiry.getTime());

    await setActor(IDS.admin2);
    await request(reqId(2), 'pause', 1);
    assert.equal((await sql(`select active from public.email_licenses where user_id='${IDS.customer}'`)).rows[0].active, false);
    await assert.rejects(request(reqId(3), 'resume', 1), /Dữ liệu đã thay đổi/);
    await request(reqId(4), 'resume', 2);
    await request(reqId(5), 'reset_device', 3);
    assert.equal((await sql(`select count(*)::int as count from public.devices where user_id='${IDS.customer}'`)).rows[0].count, 0);
    assert.equal((await sql(`select count(*)::int as count from public.admin_device_reset_history where user_id='${IDS.customer}'`)).rows[0].count, 1);

    // Server obtains operator identity from session, not a caller-provided field.
    const audit = await sql('select actor_id,action from public.admin_customer_commands order by created_at,request_id');
    assert.equal(audit.rows.length, 4);
    assert.equal(audit.rows.some(row => row.actor_id === IDS.admin1), true);
    assert.equal(audit.rows.some(row => row.actor_id === IDS.admin2), true);
    const auditRpc = await sql(`select * from public.admin_customer_audit('${IDS.customer}'::uuid,30)`);
    assert.equal(auditRpc.rows.length, 4);
    assert.equal(auditRpc.rows.some(row => row.action === 'reset_device'), true);

    await setActor(IDS.customer);
    await assert.rejects(request(reqId(6), 'pause', 4), /Không có quyền quản trị/);
    await setActor(IDS.admin1);
    await assert.rejects(db.query('select public.admin_customer_command($1::uuid,$2,$3::uuid,$4::bigint,$5::integer,$6)',
      [reqId(7),'pause',IDS.admin2,0,null,'Lý do kiểm tra quyền chủ']), /Không thao tác trên tài khoản Admin/);

    // Grants and RLS must be tested as actual PostgreSQL roles, not just owner.
    await sql('set role authenticated');
    const readAllowed = await sql('select * from public.admin_customer_overview()');
    assert.equal(readAllowed.rows.length, 1);
    assert.equal((await sql(`select count(*)::int as count from public.admin_customer_audit('${IDS.customer}'::uuid,30)`)).rows[0].count, 4);
    const granted = await request(reqId(8), 'pause', 4);
    assert.equal(granted.rows[0].result.success, true);
    await assert.rejects(sql('select count(*)::int as count from public.admin_customer_commands'), /permission denied/);
    await sql('reset role');
    await sql('set role anon');
    await assert.rejects(request(reqId(9), 'pause', 5), /permission denied/);
    await assert.rejects(sql('select * from public.admin_customer_overview()'), /permission denied/);
    await assert.rejects(sql(`select * from public.admin_customer_audit('${IDS.customer}'::uuid,30)`), /permission denied/);
    await sql('reset role');
    await setActor(IDS.customer);
    await sql('set role authenticated');
    await assert.rejects(request(reqId(10), 'resume', 5), /Không có quyền quản trị/);
    await assert.rejects(sql('select * from public.admin_customer_overview()'), /Không có quyền Admin/);
    await assert.rejects(sql(`select * from public.admin_customer_audit('${IDS.customer}'::uuid,30)`), /Không có quyền Admin/);
    await sql('reset role');
  } finally {
    await db.close();
  }
});
