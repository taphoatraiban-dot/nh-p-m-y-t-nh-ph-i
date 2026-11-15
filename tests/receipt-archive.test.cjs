'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./helpers/receipt-endpoint.cjs');
const paid={id:1,owner_user_id:'owner-a',receipt_code:'CQ-ABC123',status:'redeemed',archived_at:null,paid_amount_vnd:12345,redeemed_at:'2026-11-14T10:00:00Z',receipt_snapshot:{customer:'private'}};
const foreign={...paid,id:2,owner_user_id:'owner-b',receipt_code:'CQ-DEF456'};
test('archive requires login, confirmation and valid codes; no invalid request mutates records',async()=>{
 const s=setup([paid]);
 for(const token of ['', 'invalid'])assert.equal((await s.call('owner-archive',{codes:[paid.receipt_code],confirmation:'LUU TRU'},token)).status,401);
 for(const body of [{codes:[],confirmation:'LUU TRU'},{codes:[paid.receipt_code]},{codes:['bad'],confirmation:'LUU TRU'},{codes:[paid.receipt_code,paid.receipt_code],confirmation:'LUU TRU'}])assert.equal((await s.call('owner-archive',body)).status,400);
 assert.deepEqual(s.rows,[paid]);
});
test('archive and restore only change visibility for owner-owned receipts',async()=>{
 const s=setup([paid,foreign]);const codes=[paid.receipt_code,foreign.receipt_code];
 const archived=await s.call('owner-archive',{codes,confirmation:'LUU TRU',user_id:'owner-b'});
 assert.equal(archived.status,200);assert.deepEqual(archived.body.codes,[paid.receipt_code]);
 assert(s.rows[0].archived_at);assert.deepEqual(s.rows[1],foreign);
 assert.deepEqual((await s.call('owner-archived')).body.receipts.map(r=>r.code),[paid.receipt_code]);
 assert.equal((await s.call('owner-detail',{code:foreign.receipt_code})).status,404);
 assert.equal((await s.call('owner-restore',{codes,confirmation:'KHOI PHUC'})).status,200);
 assert.deepEqual(s.rows,[paid,foreign]);assert(!s.queries.some(q=>q.deleted));
});
test('bulk archive is bounded, idempotent and retains settled history',async()=>{
 const originals=Array.from({length:101},(_,i)=>({...paid,id:i+1,receipt_code:'CQ-ABC'+String(i).padStart(3,'0')}));
 const s=setup([...originals,foreign]);
 assert.equal((await s.call('owner-archive-all',{confirmation:'wrong'})).status,400);
 const first=await s.call('owner-archive-all',{confirmation:'LUU TRU TAT CA'});assert.equal(first.body.archivedCount,100);assert.equal(first.body.hasMore,true);
 const second=await s.call('owner-archive-all',{confirmation:'LUU TRU TAT CA'});assert.equal(second.body.archivedCount,1);assert.equal(second.body.hasMore,false);
 assert.equal((await s.call('owner-archive-all',{confirmation:'LUU TRU TAT CA'})).body.archivedCount,0);
 s.rows.slice(0,101).forEach((r,i)=>assert.deepEqual({...r,archived_at:null},originals[i]));assert.deepEqual(s.rows.at(-1),foreign);
 // Paid history remains visible even while archived.
 assert.equal((await s.call('owner-history')).body.receipts.length,100);
 const page=await s.call('owner-archived',{page:0});assert.equal(page.body.receipts.length,100);assert.equal(page.body.hasMore,true);
 assert.equal((await s.call('owner-archived',{page:1})).body.receipts.length,1);
});
test('old permanent-delete requests fail visibly without changing records',async()=>{
 const s=setup([paid]);for(const action of ['owner-delete','owner-delete-all'])assert.equal((await s.call(action,{codes:[paid.receipt_code],confirmation:'XOA VINH VIEN'})).status,409);
 assert.deepEqual(s.rows,[paid]);
});
