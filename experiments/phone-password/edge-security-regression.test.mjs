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
