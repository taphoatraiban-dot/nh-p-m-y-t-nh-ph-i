'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const {setup:backend}=require('../helpers/receipt-endpoint.cjs');
const html=fs.readFileSync(path.join(__dirname,'../../qr-management.html'),'utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].at(-1)[1];
const tick=()=>new Promise(r=>setTimeout(r,10));
async function setup(){
 const server=backend([{id:1,owner_user_id:'owner-a',receipt_code:'CQ-ABC123',status:'active',issued_at:'2026-11-14T10:00:00Z',archived_at:null,receipt_snapshot:{customer:'Private A',date:'2026-11-14'}},{id:2,owner_user_id:'owner-a',receipt_code:'CQ-DEF456',status:'redeemed',archived_at:null,paid_amount_vnd:12345,redeemed_at:'2026-11-14T11:00:00Z',receipt_snapshot:{customer:'Private A',date:'2026-11-14'}}]);
 const dom=new JSDOM(html,{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;let session={access_token:'valid',user:{id:'owner-a'}},authChange,release=null;const calls=[];
 w.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session}}),onAuthStateChange:cb=>{authChange=cb;}}})};
 w.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);calls.push(b);const result=await server.call(b.action,b,opts.headers.authorization.slice(7));if(release)await release;return{ok:result.status===200,status:result.status,json:async()=>result.body};};
 w.eval(script);await tick();
 return{dom,w,server,calls,el:id=>w.document.getElementById(id),logout(){session=null;authChange('SIGNED_OUT',null);},wait(promise){release=promise;}};
}
test('management archives and restores records without deleting QR identity or paid history',async()=>{
 const s=await setup();try{
  assert(!s.el('archive').hidden);assert(s.el('paidTable').textContent.includes('CQ-DEF456'));
  s.el('selectVisible').click();s.el('deleteSelected').click();await tick();assert(!s.el('confirmOverlay').hidden);
  assert(!s.calls.some(c=>c.action==='owner-archive'));s.el('confirmInput').value='LUU TRU';s.el('confirmYes').click();await tick();
  assert.equal(s.server.rows.length,2);assert(s.server.rows[0].archived_at);assert(!s.el('openTable').textContent.includes('CQ-ABC123'));
  s.el('archiveBtn').click();await tick();assert(s.el('archiveList').textContent.includes('CQ-ABC123'));
  [...s.el('archiveList').querySelectorAll('button')].find(b=>b.textContent==='KHÔI PHỤC').click();await tick();
  assert.equal(s.server.rows[0].archived_at,null);assert(s.el('openTable').textContent.includes('CQ-ABC123'));assert.equal(s.server.rows[1].paid_amount_vnd,12345);
 }finally{s.dom.window.close();}
});
test('bulk archive preserves all rows and settlement metadata',async()=>{
 const s=await setup();try{
  s.el('deleteAll').click();await tick();s.el('confirmInput').value='LUU TRU TAT CA';s.el('confirmYes').click();await tick();
  assert(s.server.rows.every(r=>r.archived_at));assert.equal(s.server.rows.length,2);assert.equal(s.server.rows[1].paid_amount_vnd,12345);assert(s.el('paidTable').textContent.includes('CQ-DEF456'));
 }finally{s.dom.window.close();}
});
test('logout clears private content and rejects a late archive-history response',async()=>{
 const s=await setup();try{
  let finish;s.wait(new Promise(r=>finish=r));s.el('archiveBtn').click();await tick();s.logout();finish();await tick();
  assert(s.el('archive').hidden);assert(s.el('content').hidden);assert(s.el('paid').hidden);assert.equal(s.el('openTable').textContent,'');assert.equal(s.el('paidTable').textContent,'');assert.equal(s.el('archiveList').textContent,'');
 }finally{s.dom.window.close();}
});
