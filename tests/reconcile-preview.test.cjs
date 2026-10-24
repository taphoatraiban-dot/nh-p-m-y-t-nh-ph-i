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

test('generated browser script compiles without duplicate declarations',()=>{
 const {Script}=require('node:vm');
 const html=build();
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 new Script(scripts[0][1]);
});
test('browser preview initializes, filters and ignores replay',()=>{
 const {runInNewContext}=require('node:vm');
 function element(){return {value:'',textContent:'',children:[],events:{},append(x){this.children.push(x);},replaceChildren(){this.children=[];},setAttribute(){},addEventListener(n,fn){this.events[n]=fn;}};}
 const ids=['date','region','chat','replay','actual','expected','delta','status','summary','messages'];
 const elements=Object.fromEntries(ids.map(id=>[id,element()]));elements.date.value='2026-10-24';
 const script=build().match(/<script>([\s\S]*?)<\/script>/)[1];
 runInNewContext(script,{document:{getElementById:id=>elements[id],createElement:element}},{timeout:2000});
 assert.equal(elements.actual.textContent,'818.500 đ');assert.equal(elements.delta.textContent,'0 đ');
 assert.equal(elements.messages.children.length,6);
 elements.replay.onclick();assert.equal(elements.actual.textContent,'818.500 đ');assert.match(elements.status.textContent,/6 dòng phát lại/);
 elements.region.value='MB';elements.region.events.change();assert.equal(elements.actual.textContent,'750.000 đ');
 elements.region.value='';elements.chat.value='-2';elements.chat.events.change();assert.equal(elements.actual.textContent,'48.500 đ');
 assert.equal(elements.messages.children.length,2);
});
