import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration = name => readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const names = [
 '20261101002000_stage_commercial_orders_only.sql',
 '20261101003000_stage_admin_commercial_rpcs.sql',
 '20261101004000_stage_admin_commercial_list.sql',
 '20261101005000_stage_admin_cancel_order.sql'
];

test('all four commercial migrations remain staged and isolated',()=>{
 const sql=names.map(migration).join('\n');
 assert.match(sql,/ott_commercial_orders/);
 assert.doesNotMatch(sql,/\b(?:drop|truncate)\s+table\s+public\./i);
 assert.doesNotMatch(sql,/\b(?:update|delete\s+from|insert\s+into)\s+public\.(?:devices|licenses|email_licenses|member_subscriptions|ott_memberships|admin_users|profiles)\b/i);
});
test('ledger has RLS and direct client access revoked',()=>{
 const sql=migration(names[0]);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on public\.ott_commercial_orders from anon,authenticated/i);
 assert.match(sql,/check\s*\(\s*\(status='confirmed'/i);
});
test('each commercial RPC checks administrator membership',()=>{
 for(const name of names.slice(1)){
  const sql=migration(name);
  assert.match(sql,/from public\.admin_users where user_id=auth\.uid\(\)/i);
  assert.match(sql,/security definer set search_path = ''/i);
  assert.match(sql,/revoke all on function public\./i);
 }
});

test('payment confirmation only transitions pending orders',()=>{
 const sql=migration(names[1]);
 assert.match(sql,/where id=p_order_id and status='pending'/i);
 assert.match(sql,/set status='confirmed',confirmed_by=auth\.uid\(\),confirmed_at=now\(\)/i);
});
test('cancellation only transitions pending orders',()=>{
 const sql=migration(names[3]);
 assert.match(sql,/set status='cancelled'/i);
 assert.match(sql,/where id=p_order_id and status='pending'/i);
});
test('server prices are fixed and print package is not for sale',()=>{
 const sql=migration(names[1]);
 for(const amount of ['799000','2290000','4390000','7990000']) assert.match(sql,new RegExp('\\b'+amount+'\\b'));
 assert.match(sql,/p_plan_code is distinct from 'WEB'/i);
});
