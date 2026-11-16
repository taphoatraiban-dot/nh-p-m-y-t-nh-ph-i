import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../supabase/functions/receipt-verify/index.ts',import.meta.url),'utf8');
const publicStart=source.indexOf('if (action === "check")');
const ownerStart=source.indexOf('const publicResult = action === "public-result"',publicStart);
const publicCode=source.slice(publicStart,ownerStart);
test('public receipt lookup returns only explicitly sanitized display fields',()=>{
 assert.ok(publicStart>=0&&ownerStart>publicStart);
 assert.match(publicCode,/\.select\("receipt_code,status,issued_at,redeemed_at,receipt_snapshot"\)/);
 assert.match(publicCode,/const items = Array\.isArray\(original\.items\)/);
 assert.match(publicCode,/const safeText =/);
 assert.doesNotMatch(publicCode,/original\.verificationSource|owner_user_id|payoutRatesSnapshot|original\.customer/);
});
test('public response has explicit safe fields, never spreads source',()=>{
 assert.match(publicCode,/return respond\(\{ receipt_code: data\.receipt_code, status: data\.status, issued_at: data\.issued_at, redeemed_at: data\.redeemed_at,/);
 assert.match(publicCode,/receipt: \{ date: safeText\(original\.date\), time: safeText\(original\.time\), items,/);
 assert.doesNotMatch(publicCode,/\.\.\.data|\.\.\.original/);
});
test('owner results require authenticated ownership',()=>{
 assert.match(source,/if \(!publicResult && !user\) return respond\(\{ error: "unauthorized" \}, 401\)/);
 assert.match(source,/if \(!publicResult\) lookup = lookup\.eq\("owner_user_id", user!\.id\)/);
});
test('rate snapshot is returned only in owner-result source',()=>{
 assert.match(source,/payoutRatesSnapshot: source\.payoutRatesSnapshot/);
 assert.doesNotMatch(publicCode,/payoutRatesSnapshot/);
});
