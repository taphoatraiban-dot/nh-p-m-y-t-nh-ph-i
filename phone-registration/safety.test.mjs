import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const demo=readFileSync(new URL('./demo.html',import.meta.url),'utf8');
const adapter=readFileSync(new URL('./registration-adapter.mjs',import.meta.url),'utf8');
test('demo offers both methods but never submits registration',()=>{
 assert.match(demo,/id="phoneTab"/);
 assert.match(demo,/id="emailTab"/);
 assert.match(demo,/chưa tạo tài khoản/);
 assert.doesNotMatch(demo,/auth\.signUp\s*\(/);
 assert.doesNotMatch(demo,/fetch\s*\(/);
});
test('adapter does not change legacy licensing or grant phone ownership',()=>{
 assert.match(adapter,/phone_contact_unverified/);
 assert.match(adapter,/phoneVerified:false,licenseGranted:false/);
 assert.doesNotMatch(adapter,/signInWithPassword|updateUser|admin_activate_license|claim_device/);
});
