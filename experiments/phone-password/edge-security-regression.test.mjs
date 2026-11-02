import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Static guardrails for the isolated Edge Function. These are not runtime/RLS tests.
const edge = readFileSync(new URL('./supabase/functions/phone-password-auth/index.ts', import.meta.url), 'utf8');

test('phone accounts are explicitly unverified', () => {
  assert.match(edge, /phone_verified:false/);
});

test('unknown origins are not reflected in CORS responses', () => {
  assert.match(edge, /"access-control-allow-origin":origin&&ALLOWED\.has\(origin\)\?origin:"null"/);
  assert.doesNotMatch(edge, /"access-control-allow-origin":origin\?\?/);
});

test('missing phone account never falls back to Gmail access', () => {
  assert.match(edge, /!account&&\(identity\.user\.app_metadata\?\.cuncun_auth_type==="phone_password"\|\|identity\.user\.user_metadata\?\.auth_method==="phone_alias"/);
});

test('deny and revoke both deactivate licenses', () => {
  const rpc=readFileSync(new URL('./supabase/migrations/202611020002_phone_admin_transaction.sql',import.meta.url),'utf8');
  assert.match(rpc,/p_action='deny'/);
  assert.match(rpc,/update public.licenses set active=false/);
  assert.match(edge,/phone_auth_admin_change/);
});

test('license reads and expiry parsing fail closed', () => {
  assert.match(edge, /phone_auth_admin_change/);
  assert.match(edge, /!Number\.isFinite\(Date\.parse\(license\.expires_at\)\)/);
});

const migration = readFileSync(new URL('./supabase/migrations/202611020001_phone_auth_accounts.sql', import.meta.url), 'utf8');
test('phone account license check precedes email license', () => {
  const phone = migration.indexOf('Phone identities must use phone approval');
  const email = migration.indexOf('select el.expires_at into v_license');
  assert.ok(phone >= 0 && email > phone);
});
test('phone account tables require RLS', () => {
  assert.ok(migration.includes('alter table public.phone_auth_accounts enable row level security'));
  assert.ok(migration.includes('alter table public.phone_auth_audit enable row level security'));
});

const rls = readFileSync(new URL('./supabase/staging_restrictive_rls.sql', import.meta.url), 'utf8');
test('critical tables have restrictive phone license policies', () => {
  for (const table of ['print_queue','printed_phoi','telegram_messages','customer_message_archive']) {
    assert.match(rls, new RegExp('create policy phone_license_guard on public\\.'+table+' as restrictive'));
  }
  assert.match(rls, /phone_auth_has_active_license/);
});
test('phone identities are denied if phone mapping is missing', () => {
  assert.match(rls, /u\.email like 'phone-%@accounts\.invalid'/);
  assert.match(rls, /raw_user_meta_data->>'auth_method'/);
});
test('phone login checks alias and Auth metadata before returning a session', () => {
  assert.match(edge, /PHONE_IDENTITY_INVALID/);
  assert.match(edge, /auth_method!=="phone_alias"/);
});
test('release UI points to deployed endpoint on isolated branch', () => {
  const ui=readFileSync(new URL('./phone-auth.html', import.meta.url),'utf8');
  const admin=readFileSync(new URL('./admin-phone.html', import.meta.url),'utf8');
  assert.match(ui,/const api='https:\/\/zigpqddlhvjbjrwhfhaa\.supabase\.co\/functions\/v1\/phone-password-auth';/);
  assert.match(admin,/const API_URL='https:\/\/zigpqddlhvjbjrwhfhaa\.supabase\.co\/functions\/v1\/phone-password-auth';/);
});

test('admin approval is atomic and never callable by authenticated clients', () => {
  const sql=readFileSync(new URL('./supabase/migrations/202611020002_phone_admin_transaction.sql',import.meta.url),'utf8');
  assert.match(sql,/security definer set search_path = ''/);
  assert.match(sql,/revoke all on function public\.phone_auth_admin_change\(uuid,uuid,text,text\) from public, anon, authenticated/);
  assert.match(sql,/grant execute on function public\.phone_auth_admin_change\(uuid,uuid,text,text\) to service_role/);
  assert.match(sql,/for update/);
  assert.match(sql,/insert into public\.phone_auth_audit/);
  assert.match(edge,/adminDb\.rpc\("phone_auth_admin_change"/);
});
test('expired license renewal does not extend from stale expiry', () => {
  const sql=readFileSync(new URL('./supabase/migrations/202611020002_phone_admin_transaction.sql',import.meta.url),'utf8');
  assert.match(sql,/v_old_active and v_old_expiry>now\(\)/);
  assert.match(sql,/least\(extract\(day from v_base\)/);
});

test('trusted Auth app metadata tags phone accounts across email changes', () => {
 assert.match(edge,/app_metadata:\{cuncun_auth_type:"phone_password"\}/);
 assert.match(edge,/data\.user\.app_metadata\?\.cuncun_auth_type!=="phone_password"/);
 assert.match(migration,/raw_app_meta_data->>'cuncun_auth_type'/);
 assert.match(rls,/raw_app_meta_data->>'cuncun_auth_type'/);
});

test('legacy Gmail admin rule remains unchanged', () => {
  assert.match(migration, /and v_role = 'admin' then/);
  assert.doesNotMatch(migration, /v_role = 'admin' or exists/);
});

test('phone alias secret is mandatory and never hardcoded', () => {
  assert.match(edge, /Deno\.env\.get\("PHONE_ALIAS_SECRET"\)/);
  assert.match(edge, /ALIAS_SECRET\)\.length < 32/);
  assert.match(edge, /HMAC/);
});
