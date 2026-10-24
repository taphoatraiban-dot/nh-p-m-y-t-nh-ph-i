'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {build,makeData}=require('../scripts/build-reconcile-preview.cjs');
const {reconcile}=require('../src/telegram-reconcile.cjs');
test('preview is generated from current tested parser and reconciliation code',()=>{
 assert.equal(fs.readFileSync(path.join(__dirname,'../doi-soat-thu.html'),'utf8'),build());
});
test('each preview message agrees with independently specified expected amount',()=>{
 const {messages,records}=makeData();
 for(const m of messages){
  const actual=records.filter(r=>r.message_id===m.id).reduce((sum,r)=>sum+r.amount,0);
  if(m.expected===null){assert.ok(m.errors.length);assert.equal(actual,0);}
  else {assert.deepEqual(m.errors,[]);assert.equal(actual,m.expected);}
 }
 assert.equal(records.reduce((sum,r)=>sum+r.amount,0),818500);
});
test('preview replay and source summaries conserve expected total',()=>{
 const {records}=makeData();const report=reconcile([...records,...records]);
 assert.equal(report.duplicates.length,records.length);
 assert.equal(report.accepted,records.length);
 assert.equal(report.summary.reduce((sum,r)=>sum+Number(r.total_decimal),0),818500);
});
