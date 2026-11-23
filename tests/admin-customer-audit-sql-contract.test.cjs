'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../prototypes/sql/admin_customer_audit.review_only.sql'),'utf8').toLowerCase();

test('audit proposal is rollback guarded and read-only',()=>{
  assert.match(sql,/^begin;/m);
  assert.match(sql.trimEnd(),/rollback;$/);
  assert.match(sql,/return query/);
  const executable=sql.replace(/^\s*--.*$/gm,'');
  assert.doesNotMatch(executable,/\b(update|delete|insert|truncate)\b/);
});
test('audits require owner admin and filter by target user',()=>{
  assert.match(sql,/from public\.admin_users a where a\.user_id = auth\.uid\(\)/);
  assert.match(sql,/where c\.user_id = p_user_id/);
  assert.match(sql,/limit least\(greatest\(coalesce\(p_limit,30\),1\),100\)/);
  assert.match(sql,/grant execute on function public\.admin_customer_audit\(uuid,integer\)\s+to authenticated/);
  assert.match(sql,/revoke all on function public\.admin_customer_audit\(uuid,integer\)/);
});
