// Run: node --test tests/receipt-qr.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const qr=require('../src/receipt-qr.js');
const receipt=require('../src/ios-share-phoi.js');
test('Rejects invalid tokens',()=>{
  assert.throws(()=>qr.validateToken('abc'));
  assert.equal(qr.validateToken('a'.repeat(64)),'a'.repeat(64));
});
function fakeDocument(){
  const events=[];
  const context={
    fillRect(...x){events.push(['fillRect',...x]);},beginPath(){},moveTo(){},lineTo(){},stroke(){},
    fillText(text){events.push(['text',text]);},
    measureText(s){return {width:s.length*12};},
  };
  return {events,createElement(tag){assert.equal(tag,'canvas');return {width:0,height:0,getContext(){return context;}};}};
}
test('Receipt prints QR modules and footer when matrix is supplied',()=>{
  const doc=fakeDocument();
  const qrMatrix=Array.from({length:21},(_,y)=>Array.from({length:21},(_,x)=>(x+y)%2));
  const canvas=receipt.render('[[TABLE80]]'+JSON.stringify({code:'CQ-123',items:[{content:'33b20.',amount:'576k'}],total:'576k',qrMatrix}),doc);
  assert.ok(canvas.height>500);
  assert.ok(doc.events.some(x=>x[0]==='text'&&x[1]==='QUÉT QR ĐỂ XÁC THỰC PHIẾU'));
  assert.ok(doc.events.filter(x=>x[0]==='fillRect').length>30);
});
test('Legacy receipt does not show QR without valid matrix',()=>{
  const doc=fakeDocument();
  receipt.render('[[TABLE80]]'+JSON.stringify({items:[],code:'ABCD'}),doc);
  assert.ok(!doc.events.some(x=>x[0]==='text'&&x[1]==='QUÉT QR ĐỂ XÁC THỰC PHIẾU'));
});
