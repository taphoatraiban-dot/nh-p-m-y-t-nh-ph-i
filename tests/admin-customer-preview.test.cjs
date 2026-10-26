'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../prototypes/admin-customer-center.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('standalone admin preview script parses', () => {
  assert.ok(script, 'script block exists');
  assert.doesNotThrow(() => new Function(script));
});

test('preview has unique element ids and its scripted references exist', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate IDs can break browser controls');
  const referenced = [...script.matchAll(/\$\('([^']+)'\)/g)].map(match => match[1]);
  for (const id of referenced) assert.ok(ids.includes(id), `missing element: ${id}`);
});

test('preview contains all five planned sections and owner role simulator', () => {
  for (const id of ['overview', 'customers', 'devices', 'audit', 'detail', 'demoRole', 'accessDenied']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const role of ['admin1', 'admin2', 'customer']) assert.match(html, new RegExp(`value="${role}"`));
});

test('customer table offers search, status, ordering and clear-filter controls', () => {
  for (const id of ['search', 'filter', 'sort', 'clearFilters', 'resultCount', 'customerRows', 'customerEmpty']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(script, /clearFilters'\)\.addEventListener/);
  assert.match(script, /expiryValue\(a\.expires\)-expiryValue\(b\.expires\)/);
  assert.match(html, /value="expired"/);
  assert.match(html, /#customerRows tr\{display:block/);
  assert.match(script, /td\.dataset\.label=label/);
});

test('customer detail separates license, devices and audit while write controls remain disabled', () => {
  for (const id of ['detailFields', 'detailLicense', 'detailDevices', 'detailHistory']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(script, /detailLicense'\)\.textContent/);
  assert.match(script, /detailDevices'\)\.textContent/);
  assert.match(html, /Chưa có nhật ký thật trong bản mẫu/);
});

test('prototype is isolated from production services and stores no credentials', () => {
  assert.doesNotMatch(script, /fetch\s*\(|XMLHttpRequest|WebSocket|createClient|\.rpc\s*\(/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(html, /zigpqddlhvjbjrwhfhaa|sb_publishable_|service_role/);
});

test('write actions are disabled in the preview', () => {
  for (const label of ['Gia hạn', 'Tạm ngưng', 'Đổi thiết bị']) {
    assert.match(html, new RegExp(`<button class="btn disabled" disabled>${label}</button>`));
  }
});
