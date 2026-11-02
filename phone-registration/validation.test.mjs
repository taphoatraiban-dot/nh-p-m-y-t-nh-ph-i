import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVietnameseMobile,validateRegistrationPassword} from './validation.mjs';
test('normalizes common Vietnamese mobile formats',()=>{
 for(const input of ['0912345678','84912345678','+84912345678','0912 345 678','(0912) 345-678']){
  assert.equal(normalizeVietnameseMobile(input),'+84912345678');
 }
});
test('rejects invalid, landline, and unsafe phone input',()=>{
 for(const input of ['','0123456789','0212345678','+84912345678x','+840912345678','091234567','09123456789','abc','+84123456789']){
  assert.throws(()=>normalizeVietnameseMobile(input));
 }
});
test('requires strong minimum password length without storing passwords',()=>{
 assert.equal(validateRegistrationPassword('long-passphrase-2026'),true);
 for(const input of ['short', '', '123456789']) assert.throws(()=>validateRegistrationPassword(input));
});
