const test=require('node:test');
const assert=require('node:assert/strict');
const {ticketBytes,qrCommand}=require('../scripts/mac-one-tap/worker.cjs');

test('Worker ESC/POS bắt đầu init và in QR thật cho mã phiếu mẫu',()=>{
  const bytes=ticketBytes('2dmn\n221bdao1.\nMA PHIEU: DEMO20261028');
  assert.equal(bytes[0],27);
  assert.equal(bytes[1],64);
  assert.ok(bytes.includes(Buffer.from('CUNCUN:PHIEU:DEMO20261028')));
  assert.ok(bytes.includes(Buffer.from([29,40,107,3,0,49,81,48])));
});
test('Không cho ESC/POS injection từ nội dung khách',()=>{
  const bytes=ticketBytes('2dmn\u001b@\u001dV\nMA PHIEU: ABC123');
  assert.equal(bytes.indexOf(Buffer.from([27,64])),0);
  assert.equal(bytes.indexOf(Buffer.from([27,64]),2),-1);
});
test('QR giới hạn dữ liệu tránh tràn bộ nhớ máy in',()=>{
  assert.throws(()=>qrCommand('x'.repeat(401)),/quá dài/);
});
