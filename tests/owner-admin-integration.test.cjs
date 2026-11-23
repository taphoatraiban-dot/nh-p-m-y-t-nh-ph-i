'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const moduleCode = fs.readFileSync(path.join(root, 'src/owner-admin-center.js'), 'utf8');

test('preview module is gated behind an explicit URL flag', () => {
  assert.match(moduleCode, /get\('admin_preview'\) !== '1'\) return/);
  assert.match(app, /<script src="src\/owner-admin-center\.js" defer><\/script>/);
});

test('prototype iframe has sandboxed scripts without same-origin privilege', () => {
  assert.match(moduleCode, /frame\.sandbox = 'allow-scripts'/);
  assert.doesNotMatch(moduleCode, /allow-same-origin/);
  assert.match(moduleCode, /prototypes\/admin-customer-center\.html/);
});

test('entry point checks owner admin through existing license RPC', () => {
  assert.match(moduleCode, /sb\.rpc\('check_email_license'\)/);
  assert.match(moduleCode, /data\?\.is_admin === true/);
  assert.match(moduleCode, /authEpoch/);
  assert.doesNotMatch(moduleCode, /admin_customer_overview|admin_list_accounts/);
  assert.doesNotMatch(moduleCode, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
});

test('preview is not installed into production automatically', () => {
  assert.doesNotMatch(app, /admin_customer_overview\s*\(/);
  assert.match(moduleCode, /open\.hidden = true/);
});
