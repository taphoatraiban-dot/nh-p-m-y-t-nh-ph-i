import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/receipt-endpoint.cjs';
const token='a'.repeat(64);
const tokenHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
const receipt={id:1,owner_user_id:'owner-a',token_hash:tokenHash,receipt_code:'CQ-ABC123',status:'active',issued_at:'2026-11-14T10:00:00Z',redeemed_at:null,archived_at:null,
 receipt_snapshot:{date:'2026-11-14',time:'17:00',total:'123',totalLabel:'Total',customer:'PRIVATE CUSTOMER',items:[{station:'Test',number:'12',type:'Example',points:'1',amount:'123',secret:'PRIVATE ITEM'}],verificationSource:{rawText:'PRIVATE RAW TEXT',customerPriceKey:'PRIVATE KEY',pricedRows:[],drawDate:'2026-11-14',payoutRatesSnapshot:{secret:'PRIVATE RATES'}}}};
test('public lookup requires the exact QR capability and excludes customer, raw text and private metadata',async()=>{
 const s=setup([receipt]);
 assert.equal((await s.call('check',{token:'b'.repeat(64)},'')).status,404);
 const r=await s.call('check',{token},'');assert.equal(r.status,200);
 assert.deepEqual(Object.keys(r.body).sort(),['issued_at','receipt','receipt_code','redeemed_at','status']);
 assert.deepEqual(Object.keys(r.body.receipt).sort(),['date','items','time','total','totalLabel']);
 assert(!JSON.stringify(r.body).includes('PRIVATE'));
 assert.deepEqual(Object.keys(r.body.receipt.items[0]).sort(),['amount','content','number','points','region','station','type']);
});
test('public display text is bounded and cannot return nested source objects',async()=>{
 const s=setup([{...receipt,receipt_snapshot:{...receipt.receipt_snapshot,total:{secret:'PRIVATE'},items:[{station:'x'.repeat(500),number:{secret:'PRIVATE'},amount:Infinity}]}}]);
 const r=await s.call('check',{token},'');assert.equal(r.body.receipt.total,'');assert.equal(r.body.receipt.items[0].station.length,180);assert.equal(r.body.receipt.items[0].number,'');assert.equal(r.body.receipt.items[0].amount,'');
});
test('owner detail rejects anonymous and other-account requests',async()=>{
 const s=setup([receipt]);assert.equal((await s.call('owner-detail',{code:receipt.receipt_code},'')).status,401);
 s.user('owner-b');assert.equal((await s.call('owner-detail',{code:receipt.receipt_code})).status,404);
 s.user('owner-a');const r=await s.call('owner-detail',{code:receipt.receipt_code});assert.equal(r.status,200);assert.equal(r.body.receipt.snapshot.customer,'PRIVATE CUSTOMER');
});
