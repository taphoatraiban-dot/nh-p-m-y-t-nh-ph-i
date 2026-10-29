import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../supabase/functions/receipt-verify/index.ts',import.meta.url),'utf8');
const publicStart=source.indexOf('if (action === "check")');
const ownerStart=source.indexOf('const user = await actor(req)',publicStart);
const publicCode=source.slice(publicStart,ownerStart);
test('public receipt lookup selects only status metadata',()=>{
  assert.ok(publicStart>=0&&ownerStart>publicStart);
  assert.match(publicCode,/\.select\("receipt_code,status,issued_at,redeemed_at"\)/);
  assert.doesNotMatch(publicCode,/receipt_snapshot|customer|pricedRows|payoutRatesSnapshot|items/);
});
test('public response has explicit safe fields',()=>{
  assert.match(publicCode,/return respond\(\{ receipt_code: data\.receipt_code, status: data\.status, issued_at: data\.issued_at, redeemed_at: data\.redeemed_at \}\)/);
  assert.doesNotMatch(publicCode,/\.\.\.data/);
});
test('owner results require authenticated ownership',()=>{
  assert.match(source,/if \(!user\) return respond\(\{ error: "unauthorized" \}, 401\)/);
  assert.match(source,/\.eq\("token_hash", token_hash\)\.eq\("owner_user_id", user\.id\)/);
});
test('rate snapshot is returned only in owner-result source',()=>{
  assert.match(source,/payoutRatesSnapshot: source\.payoutRatesSnapshot/);
  assert.doesNotMatch(publicCode,/payoutRatesSnapshot/);
});
