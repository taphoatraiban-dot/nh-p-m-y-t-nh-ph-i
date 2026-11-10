const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('assets/zalo-personal/manual-import.js','utf8');
function setup(locked=false){
 const nodes=[];
 class El{
  constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.dataset={};this.style={};this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.checked=false;this.open=false;this.events=[];}
  append(...xs){this.children.push(...xs);}
  querySelector(sel){return sel==='[data-zalo-manual]'?this.children.find(x=>x.dataset?.zaloManual):null;}
  setAttribute(){}
  addEventListener(name,cb){this.listeners[name]=cb;}
  fire(name){this.listeners[name]?.();}
  dispatchEvent(e){this.events.push(e);return true;}
  focus(){this.focused=true;}
  scrollIntoView(){}
 }
 const host=new El('div'),bets=new El('textarea'),body={classList:{contains:()=>!locked}};
 const doc={body,createElement(tag){const el=new El(tag);nodes.push(el);return el;},createTextNode(t){return t;},getElementById(id){return id==='bets'?bets:null;}};
 let confirmValue=true,confirmCalls=0;
 class Event{constructor(type,opts){this.type=type;Object.assign(this,opts);}}
 const context={document:doc,Event,CustomEvent:Event,confirm(){confirmCalls++;return confirmValue;}};
 context.window=context;vm.runInNewContext(source,context);
 context.CuncunZaloManualImport.mount({host});
 const find=t=>nodes.find(n=>n.textContent===t);
 return {bets,find,nodes,setConfirm(v){confirmValue=v;},confirmCount(){return confirmCalls;}};
}
function prepare(t,text){const field=t.nodes.find(x=>x.tag==='textarea'),review=t.find('Xem trước'),check=t.nodes.find(x=>x.tag==='input'),transfer=t.find('Đưa vào ô nhập phơi');field.value=text;field.fire('input');review.fire('click');check.checked=true;check.fire('change');return {field,transfer};}
test('transfers exactly one confirmed message and fires calculator events',()=>{
 const t=setup(),p=prepare(t,'2dmn\n12.34da1.');p.transfer.fire('click');
 assert.equal(t.bets.value,'2dmn\n12.34da1.');
 assert.deepEqual(t.bets.events.map(e=>e.type),['input','change']);
 assert.equal(t.bets.events[0].detail.zaloManualImport,true);
 assert.equal(t.bets.focused,true);
});
test('cancel append keeps existing bets unchanged',()=>{
 const t=setup();t.bets.value='vtau\n11b1.';t.setConfirm(false);
 prepare(t,'2dmn\n12b1.').transfer.fire('click');
 assert.equal(t.bets.value,'vtau\n11b1.');assert.equal(t.bets.events.length,0);
});
test('approved append preserves both messages',()=>{
 const t=setup();t.bets.value='vtau\n11b1.';
 prepare(t,'2dmn\n12b1.').transfer.fire('click');
 assert.equal(t.bets.value,'vtau\n11b1.\n2dmn\n12b1.');
});
test('locked application cannot transfer',()=>{
 const t=setup(true);prepare(t,'12b1.').transfer.fire('click');
 assert.equal(t.bets.value,'');assert.equal(t.bets.events.length,0);
});
test('stale preview cannot transfer',()=>{
 const t=setup(),p=prepare(t,'12b1.');p.field.value='99b1.';p.transfer.fire('click');
 assert.equal(t.bets.value,'');assert.equal(t.bets.events.length,0);
});
test('clear draft does not touch calculator',()=>{
 const t=setup();t.bets.value='11b1.';const p=prepare(t,'12b1.');
 t.find('Xóa nội dung dán').fire('click');
 assert.equal(p.field.value,'');assert.equal(t.bets.value,'11b1.');
});
