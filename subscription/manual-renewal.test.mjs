import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareManualRenewal} from './manual-renewal.mjs';
const userId='11111111-1111-4111-8111-111111111111';
test('WEB renewal quote is pending and does not activate licenses',()=>{
 const x=prepareManualRenewal({userId,plan:'WEB',months:3,now:'2026-11-01T00:00:00Z',currentExpiry:'2026-12-01T00:00:00Z'});
 assert.equal(x.amountVnd,2290000);
 assert.equal(x.proposedExpiresAt,'2027-03-01T00:00:00.000Z');
 assert.equal(x.paymentStatus,'pending');
 assert.equal(x.licenseActivation,'admin_confirmation_required');
});
test('WEB_PRINT not sold before launch',()=>assert.throws(()=>prepareManualRenewal({userId,plan:'WEB_PRINT',months:1,now:'2026-11-01T00:00:00Z'}),RangeError));
test('reject invalid user',()=>assert.throws(()=>prepareManualRenewal({userId:'invalid',plan:'WEB',months:1,now:'2026-11-01T00:00:00Z'}),TypeError));
