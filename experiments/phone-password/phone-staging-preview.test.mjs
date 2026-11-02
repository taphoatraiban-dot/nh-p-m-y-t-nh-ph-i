import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./phone-auth-staging-preview.html', import.meta.url), 'utf8');

test('admin and customer use isolated Supabase session storage', () => {
  assert.match(html, /let client=null,adminClient=null/);
  assert.match(html, /storageKey:'cuncun-phone-staging-auth'/);
  assert.match(html, /storageKey:'cuncun-phone-staging-admin-auth'/);
  assert.match(html, /adminClient\.auth\.signInWithPassword/);
  assert.match(html, /await edge\(\{action:'list_accounts'\},true\)/);
  assert.match(html, /await adminClient\.auth\.signOut\(\)/);
  assert.match(html, /catch\(e\)\{if\(adminClient\)await adminClient\.auth\.signOut\(\)/);
});

test('phone login does not retain a session after denied license', () => {
  assert.match(html, /const access=await edge\(\{action:'check_access'\}\)/);
  assert.match(html, /if\(access\.active!==true\)throw Error/);
  assert.match(html, /if\(!data\?\.active\)\{await client\.auth\.signOut\(\)/);
  assert.match(html, /catch\(e\)\{if\(client\)await client\.auth\.signOut\(\)/);
});

test('staging page explicitly prohibits production credentials', () => {
  assert.match(html, /Không nhập mật khẩu\/tài khoản thật/);
  assert.match(html, /Không dùng URL hoặc key của Supabase production/);
  assert.ok(html.includes("projectUrl==='https://zigpqddlhvjbjrwhfhaa.supabase.co'"));
});

test('resuming staging rechecks phone approval and closes invalid sessions', () => {
  assert.match(html, /async function recheckPhoneOnResume\(force=false\)/);
  assert.match(html, /document\.addEventListener\('visibilitychange'/);
  assert.match(html, /window\.addEventListener\('focus'/);
  assert.match(html, /const access=await edge\(\{action:'check_access'\}\)/);
  assert.match(html, /await client\.auth\.signOut\(\)/);
});

test('restored phone session is checked immediately after staging connection', () => {
  assert.match(html, /Đang kiểm tra phiên đã lưu/);
  assert.match(html, /await recheckPhoneOnResume\(true\)/);
  assert.match(html, /\(!force&&document\.visibilityState==='hidden'\)/);
  assert.match(html, /Kiểm tra phiên đã lưu hoàn tất/);
});
