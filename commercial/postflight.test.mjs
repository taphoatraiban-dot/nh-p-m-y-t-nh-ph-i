import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./read-only-postflight.sql',import.meta.url),'utf8');
test('postflight SQL checks all four commercial RPCs',()=>{
 for(const name of ['ott_admin_create_commercial_order','ott_admin_confirm_commercial_order','ott_admin_list_commercial_orders','ott_admin_cancel_commercial_order']) assert.ok(sql.includes(name),name);
});
test('postflight checks RLS, direct access and execute privileges',()=>{
 for(const check of ['relrowsecurity','has_table_privilege','has_function_privilege','anon_execute','authenticated_execute']) assert.ok(sql.includes(check),check);
});
test('postflight remains read-only',()=>{
 const statements=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n');
 assert.doesNotMatch(statements,/\b(?:insert|update|delete|drop|alter|truncate|create|grant|revoke)\s+(?:table|function|into|from|public\.|on)\b/i);
 assert.match(statements,/^with\s+commercial_functions\s+as\s*\(/i);
 assert.match(statements,/\bselect\b/i);
});
