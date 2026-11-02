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
  assert.match(edge, /!account&&identity\.user\.user_metadata\?\.auth_method==="phone_alias"/);
});

test('deny and revoke both deactivate licenses', () => {
  assert.match(edge, /body\.action==="revoke"\|\|body\.action==="deny"/);
  assert.match(edge, /update\(\{active:false/);
});

test('license reads and expiry parsing fail closed', () => {
  assert.match(edge, /if\(oldLicenseError\)throw new Error\("LICENSE_READ_FAILED"\)/);
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
test('release UI cannot call undeployed API', () => {
  const ui=readFileSync(new URL('./phone-auth.html', import.meta.url),'utf8');
  const admin=readFileSync(new URL('./admin-phone.html', import.meta.url),'utf8');
  assert.match(ui,/const api='';/);
  assert.match(admin,/const API_URL='';/);
});
