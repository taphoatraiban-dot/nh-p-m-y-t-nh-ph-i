import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const demo=readFileSync(new URL('./admin-demo.html',import.meta.url),'utf8');
test('demo mounts real commercial UI with an in-memory RPC adapter',()=>{
 assert.match(demo,/import\s*\{mountCommercialAdmin\}\s*from\s*['"]\.\/admin-panel\.mjs['"]/);
 assert.match(demo,/const orders=\[\]/);
 assert.match(demo,/const client=\{async rpc\(/);
 for(const rpc of ['ott_admin_create_commercial_order','ott_admin_list_commercial_orders','ott_admin_confirm_commercial_order','ott_admin_cancel_commercial_order']) assert.ok(demo.includes(rpc),rpc);
});
test('demo never contains network calls, secrets or legacy license mutations',()=>{
 assert.doesNotMatch(demo,/https?:\/\/|fetch\s*\(|XMLHttpRequest|WebSocket|createClient\s*\(|service_role|supabaseKey|SUPABASE_URL/i);
 assert.doesNotMatch(demo,/\b(?:claim_device|admin_reset_device|admin_activate_license|admin_member_change|check_license)\b/i);
 assert.match(demo,/CHỈ LÀ DEMO/);
 assert.match(demo,/không kết nối Supabase/i);
});
test('demo offers WEB prices only and explicitly forbids print sales',()=>{
 for(const price of ['799000','2290000','4390000','7990000']) assert.ok(demo.includes(price),price);
 assert.match(demo,/p_plan_code!=='WEB'/);
});

test('admin UI keeps processed order actions disabled if refresh fails',()=>{
 const panel=readFileSync(new URL('./admin-panel.mjs',import.meta.url),'utf8');
 assert.match(panel,/button\.disabled=completed;cancel\.disabled=completed/);
 assert.match(panel,/cancel\.disabled=completed;button\.disabled=completed/);
 assert.match(panel,/completed=true;message='Đã ghi nhận thanh toán/);
 assert.match(panel,/completed=true;message='Đã hủy đơn/);
});
