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
  assert.match(edge, /!account&&identity\.user\.app_metadata\?\.auth_method==="phone_alias"/);
  assert.match(edge, /app_metadata:\{auth_method:"phone_alias"\}/);
  assert.doesNotMatch(edge, /user_metadata\?\.auth_method/);
  assert.match(edge, /account&&identity\.user\.app_metadata\?\.auth_method!=="phone_alias"/);
});

test('phone login requires server-controlled identity marker', () => {
  assert.match(edge, /data\.user\.app_metadata\?\.auth_method!=="phone_alias"/);
});

test('phone login matches the deterministic alias for the submitted number', () => {
  assert.match(edge, /data\.user\.email!==email/);
});

test('denied phone login signs out the issued auth session', () => {
  assert.match(edge, /const rejectLogin=async\(reason:string\)=>\{await client\.auth\.signOut\(\)/);
  assert.match(edge, /return await rejectLogin\("PHONE_IDENTITY_INVALID"\)/);
  assert.match(edge, /return await rejectLogin\("LICENSE_NOT_APPROVED"\)/);
  assert.match(edge, /return await rejectLogin\("LICENSE_INACTIVE"\)/);
});

test('admin transitions use one atomic service-only RPC', () => {
  assert.match(edge, /adminDb\.rpc\("phone_auth_admin_transition"/);
  assert.match(edge, /p_admin_id:adminId,p_user_id:userId,p_action:body\.action/);
  assert.doesNotMatch(edge, /from\("licenses"\)\.upsert/);
  assert.doesNotMatch(edge, /from\("phone_auth_audit"\)\.insert/);
});

test('atomic transition locks phone account and records audit in same SQL function', () => {
  const migration = readFileSync(new URL('./supabase/migrations/202611020001_phone_auth_accounts.sql', import.meta.url), 'utf8');
  const transition = migration.slice(migration.indexOf('create or replace function public.phone_auth_admin_transition'));
  assert.match(transition, /from public\.phone_auth_accounts\s+where user_id = p_user_id for update/);
  assert.match(transition, /from public\.licenses where user_id = p_user_id for update/);
  assert.match(transition, /insert into public\.licenses/);
  assert.match(transition, /update public\.phone_auth_accounts set status=/);
  assert.match(transition, /insert into public\.phone_auth_audit/);
  assert.match(transition, /if auth\.role\(\) <> 'service_role' then raise exception/);
  assert.match(transition, /from public\.admin_users where user_id = p_admin_id/);
});

test('license expiry parsing fails closed and admin transitions roll back atomically', () => {
  assert.match(edge, /!Number\.isFinite\(Date\.parse\(license\.expires_at\)\)/);
  const migration = readFileSync(new URL('./supabase/migrations/202611020001_phone_auth_accounts.sql', import.meta.url), 'utf8');
  assert.match(migration, /create or replace function public\.phone_auth_admin_transition/);
  assert.match(migration, /insert into public\.phone_auth_audit/);
  assert.match(migration, /revoke all on function public\.phone_auth_admin_transition/);
  assert.match(migration, /grant execute on function public\.phone_auth_admin_transition.*to service_role/);
});
