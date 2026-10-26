'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, '../prototypes/sql/admin_customer_overview.proposal.sql'), 'utf8').toLowerCase();

test('proposal is a guarded, read-only RPC selecting minimal columns', () => {
  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /from public\.admin_users a/);
  assert.match(sql, /return query/);
  assert.doesNotMatch(sql.replace(/^\s*--.*$/gm, ''), /\b(delete from|update\s+public\.|insert into|truncate\b)\b/);
  assert.doesNotMatch(sql, /select\s+\*/);
});

test('does not include owner admin accounts in customer records', () => {
  assert.match(sql, /where not exists\s*\(\s*select 1 from public\.admin_users a where a\.user_id = u\.id/);
  assert.match(sql, /p\.role = 'admin'/);
});

test('proposal never selects API secrets, pins or password fields', () => {
  const executable = sql.replace(/^\s*--.*$/gm, '');
  assert.doesNotMatch(executable, /api_key|encrypted_password|raw_user_meta_data|pin|bot_token/);
});
