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
  fire(name){return this.listeners[name]?.();}
  dispatchEvent(e){this.events.push(e);return true;}
  focus(){this.focused=true;}
  scrollIntoView(){}
 }
 let observerCallback;const host=new El('div'),bets=new El('textarea'),body={classList:{contains:()=>!locked}};
 const doc={body,visibilityState:'visible',listeners:{},addEventListener(type,cb){this.listeners[type]=cb;},createElement(tag){const el=new El(tag);nodes.push(el);return el;},createTextNode(t){return t;},getElementById(id){return id==='bets'?bets:null;}};
 let confirmValue=true,confirmCalls=0;
 class Event{constructor(type,opts){this.type=type;Object.assign(this,opts);}}
 const pageListeners={};const context={document:doc,Event,CustomEvent:Event,addEventListener(type,cb){pageListeners[type]=cb;},MutationObserver:class{constructor(cb){observerCallback=cb;}observe(){}},confirm(){confirmCalls++;return confirmValue;}};
 context.window=context;vm.runInNewContext(source,context);
 context.CuncunZaloManualImport.mount({host});
 const find=t=>nodes.find(n=>n.textContent===t);
 return {host,bets,find,nodes,context,background(){doc.visibilityState='hidden';doc.listeners.visibilitychange?.();},foreground(){doc.visibilityState='visible';doc.listeners.visibilitychange?.();},pagehide(){pageListeners.pagehide?.();},lock(){locked=true;observerCallback?.();},unlock(){locked=false;observerCallback?.();},lockWithoutObserver(){locked=true;},setConfirm(v){confirmValue=v;},confirmCount(){return confirmCalls;}};
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

test('pending clipboard read cannot resurrect a cleared draft',async()=>{
 const t=setup();let resolve;
 t.context.navigator={clipboard:{readText:()=>new Promise(r=>{resolve=r;})}};
 const field=t.nodes.find(x=>x.tag==='textarea');
 field.value='original';
 const pending=t.find('Dán từ bộ nhớ tạm').fire('click');
 t.find('Xóa nội dung dán').fire('click');
 resolve('stale clipboard');
 await pending;
 assert.equal(field.value,'');
 assert.equal(t.bets.value,'');
});
test('newer clipboard paste wins over an older pending read',async()=>{
 const t=setup();const pending=[];
 t.context.navigator={clipboard:{readText:()=>new Promise(r=>pending.push(r))}};
 const field=t.nodes.find(x=>x.tag==='textarea');
 const first=t.find('Dán từ bộ nhớ tạm').fire('click');
 const second=t.find('Dán từ bộ nhớ tạm').fire('click');
 pending[1]('new content');await second;
 pending[0]('old content');await first;
 assert.equal(field.value,'new content');
});

test('clipboard permission denial keeps existing draft intact',async()=>{
 const t=setup();t.context.navigator={clipboard:{readText:async()=>{throw Error('denied')}}};
 const field=t.nodes.find(x=>x.tag==='textarea');field.value='existing draft';
 await t.find('Dán từ bộ nhớ tạm').fire('click');
 assert.equal(field.value,'existing draft');
 assert.equal(t.bets.value,'');
});
test('oversized clipboard text is rejected without truncation',async()=>{
 const t=setup();t.context.navigator={clipboard:{readText:async()=> 'x'.repeat(12001)}};
 const field=t.nodes.find(x=>x.tag==='textarea');field.value='existing draft';
 await t.find('Dán từ bộ nhớ tạm').fire('click');
 assert.equal(field.value,'existing draft');
 assert.equal(t.bets.value,'');
});
test('manual import mount is idempotent on the same host',()=>{
 const t=setup();
 const count=t.nodes.length;
 const first=t.host.children[0];
 const second=t.context.CuncunZaloManualImport.mount({host:t.host});
 assert.equal(second,first);
 assert.equal(t.host.children.length,1);
 assert.equal(t.nodes.length,count);
});

test('successful clipboard paste requires review and consent before transfer',async()=>{
 const t=setup();t.context.navigator={clipboard:{readText:async()=> '2dmn\\n12.34da1.'}};
 const field=t.nodes.find(x=>x.tag==='textarea');
 await t.find('Dán từ bộ nhớ tạm').fire('click');
 assert.equal(field.value,'2dmn\\n12.34da1.');
 assert.equal(t.bets.value,'');
 const transfer=t.find('Đưa vào ô nhập phơi');
 assert.equal(transfer.disabled,true);
 t.find('Xem trước').fire('click');
 assert.equal(transfer.disabled,true);
 t.nodes.find(x=>x.tag==='input').checked=true;
 t.nodes.find(x=>x.tag==='input').fire('change');
 transfer.fire('click');
 assert.equal(t.bets.value,'2dmn\\n12.34da1.');
});
test('typing during clipboard read preserves typed content',async()=>{
 const t=setup();let resolve;
 t.context.navigator={clipboard:{readText:()=>new Promise(r=>{resolve=r;})}};
 const field=t.nodes.find(x=>x.tag==='textarea');
 const pending=t.find('Dán từ bộ nhớ tạm').fire('click');
 field.value='typed later';field.fire('input');
 resolve('old clipboard');await pending;
 assert.equal(field.value,'typed later');
 assert.equal(t.bets.value,'');
});

test('locking clears Zalo draft and preview but preserves calculator bets',()=>{
 const t=setup();t.bets.value='11b1.';
 const p=prepare(t,'private Zalo text');
 t.lock();
 assert.equal(p.field.value,'');
 assert.equal(t.bets.value,'11b1.');
 assert.equal(p.transfer.disabled,true);
 assert.equal(t.nodes.find(n=>n.tag==='pre').textContent,'');
});
test('clipboard resolution after lock never restores private text',async()=>{
 const t=setup();let resolve;
 t.context.navigator={clipboard:{readText:()=>new Promise(r=>{resolve=r;})}};
 const pending=t.find('Dán từ bộ nhớ tạm').fire('click');
 t.lock();resolve('private content');await pending;
 assert.equal(t.nodes.find(n=>n.tag==='textarea').value,'');
 assert.equal(t.bets.value,'');
});

test('locked input event clears typed private content',()=>{
 const t=setup(true),field=t.nodes.find(n=>n.tag==='textarea');
 field.value='secret';field.fire('input');
 assert.equal(field.value,'');
 assert.equal(t.bets.value,'');
});
test('lock during append confirmation never modifies calculator',()=>{
 const t=setup();t.bets.value='2dmn\n12b1.';
 const p=prepare(t,'2dmn\n34b1.');
 t.context.confirm=()=>{t.lockWithoutObserver();return true;};
 p.transfer.fire('click');
 assert.equal(t.bets.value,'2dmn\n12b1.');
 assert.equal(p.field.value,'');
 assert.equal(t.bets.events.length,0);
});

test('pagehide clears temporary Zalo text without modifying calculator',()=>{
 const t=setup();t.bets.value='existing bets';const p=prepare(t,'private message');
 t.pagehide();
 assert.equal(p.field.value,'');
 assert.equal(t.bets.value,'existing bets');
 assert.equal(p.transfer.disabled,true);
});
test('pending clipboard read cannot restore text after pagehide',async()=>{
 const t=setup();let resolve;
 t.context.navigator={clipboard:{readText:()=>new Promise(r=>{resolve=r;})}};
 const pending=t.find('Dán từ bộ nhớ tạm').fire('click');
 t.pagehide();resolve('private text');await pending;
 assert.equal(t.nodes.find(n=>n.tag==='textarea').value,'');
 assert.equal(t.bets.value,'');
});

test('review action invalidates a pending clipboard read',async()=>{
 const t=setup();let resolve;
 t.context.navigator={clipboard:{readText:()=>new Promise(r=>{resolve=r;})}};
 const field=t.nodes.find(n=>n.tag==='textarea');
 field.value='reviewed text';
 const pending=t.find('Dán từ bộ nhớ tạm').fire('click');
 t.find('Xem trước').fire('click');
 resolve('late clipboard');await pending;
 assert.equal(field.value,'reviewed text');
 assert.equal(t.nodes.find(n=>n.tag==='pre').textContent,'reviewed text');
 assert.equal(t.bets.value,'');
});

test('character counter follows typing and clearing draft',()=>{
 const t=setup(),field=t.nodes.find(n=>n.tag==='textarea');
 const counter=t.nodes.find(n=>n.tag==='p'&&n.textContent==='0 / 12.000 ký tự');
 assert.ok(counter);
 field.value='12345';field.fire('input');
 assert.equal(counter.textContent,'5 / 12.000 ký tự');
 t.find('Xóa nội dung dán').fire('click');
 assert.equal(counter.textContent,'0 / 12.000 ký tự');
 assert.equal(t.bets.value,'');
});

test('stale clipboard completion does not overwrite clear confirmation',async()=>{
 const t=setup();let resolve;
 t.context.navigator={clipboard:{readText:()=>new Promise(r=>{resolve=r;})}};
 const field=t.nodes.find(n=>n.tag==='textarea');field.value='draft';
 const pending=t.find('Dán từ bộ nhớ tạm').fire('click');
 t.find('Xóa nội dung dán').fire('click');
 const status=t.nodes.find(n=>n.tag==='p'&&n.textContent.includes('Đã xóa nội dung dán Zalo'));
 assert.ok(status);
 resolve('late');await pending;
 assert.match(status.textContent,/Đã xóa nội dung dán Zalo/);
 assert.equal(field.value,'');
});

test('concurrent calculator edit during append confirmation aborts Zalo transfer',()=>{
 const t=setup();t.bets.value='2dmn\n12b1.';
 t.context.confirm=()=>{t.bets.value='2dmn\n56b1.';return true;};
 prepare(t,'2dmn\n12b1.').transfer.fire('click');
 assert.equal(t.bets.value,'2dmn\n56b1.');
 assert.equal(t.bets.events.length,0);
});

test('Zalo input composer is visible immediately on mobile',()=>{
 const t=setup();const panel=t.nodes.find(n=>n.tag==='details');
 const field=t.nodes.find(n=>n.tag==='textarea');
 assert.equal(panel.open,true);
 assert.match(field.placeholder,/Nhập tin/);
 assert.equal(field.maxLength,12000);
});

test('manual chat composer and preview label do not imply Zalo synchronization',()=>{
 const t=setup();
 const label=t.nodes.find(n=>n.textContent==='TIN NHẮN NHẬP THỦ CÔNG');
 const previewLabel=t.nodes.find(n=>n.textContent==='XEM TRƯỚC TIN NHẮN');
 const composer=t.nodes.find(n=>n.tag==='div'&&n.children.includes(label));
 const field=t.nodes.find(n=>n.tag==='textarea');
 assert.ok(composer);
 assert.ok(composer.children.includes(field));
 assert.equal(previewLabel.hidden,true);
 prepare(t,'2dmn\n12b1.');
 assert.equal(previewLabel.hidden,false);
 t.find('Xóa nội dung dán').fire('click');
 assert.equal(previewLabel.hidden,true);
});

test('clear empty composer cancels a pending clipboard read',async()=>{
 const t=setup();let resolve;
 t.context.navigator={clipboard:{readText:()=>new Promise(r=>{resolve=r;})}};
 const pending=t.find('Dán từ bộ nhớ tạm').fire('click');
 t.find('Xóa nội dung dán').fire('click');
 resolve('late private Zalo text');await pending;
 const field=t.nodes.find(n=>n.tag==='textarea');
 assert.equal(field.value,'');
 assert.equal(t.bets.value,'');
 assert.equal(t.confirmCount(),0);
});

test('oversized programmatic paste cannot be reviewed or transferred',()=>{
 const t=setup(),field=t.nodes.find(n=>n.tag==='textarea');
 field.value='1'.repeat(12001);field.fire('input');
 t.find('Xem trước').fire('click');
 const transfer=t.find('Đưa vào ô nhập phơi');
 assert.equal(transfer.disabled,true);
 assert.equal(t.bets.value,'');
});

test('unfinished existing bet blocks append without modifying calculator',()=>{
 const t=setup();t.bets.value='2dmn\n12b0,5n';
 prepare(t,'2dmn\n34b1.').transfer.fire('click');
 assert.equal(t.bets.value,'2dmn\n12b0,5n');
 assert.equal(t.bets.events.length,0);
 assert.equal(t.confirmCount(),0);
});

test('composer stays expanded after a successful transfer',()=>{
 const t=setup(),p=prepare(t,'2dmn\n12b1.');
 p.transfer.fire('click');
 const panel=t.nodes.find(n=>n.tag==='details');
 assert.equal(panel.open,true);
 assert.equal(p.field.value,'');
 assert.equal(t.bets.value,'2dmn\n12b1.');
});

test('unlock restores an empty visible composer without restoring private draft',()=>{
 const t=setup(),field=t.nodes.find(n=>n.tag==='textarea');
 const panel=t.nodes.find(n=>n.tag==='details');
 field.value='private Zalo message';field.fire('input');
 t.lock();
 assert.equal(panel.open,false);
 assert.equal(field.value,'');
 t.unlock();
 assert.equal(panel.open,true);
 assert.equal(field.value,'');
 assert.equal(t.bets.value,'');
});

test('mobile action buttons wrap and remain available inside the panel',()=>{
 const t=setup();
 const paste=t.find('Dán từ bộ nhớ tạm'),review=t.find('Xem trước');
 const clear=t.find('Xóa nội dung dán'),transfer=t.find('Đưa vào ô nhập phơi');
 const actionBar=t.nodes.find(n=>n.tag==='div'&&n.children.includes(paste));
 const transferBar=t.nodes.find(n=>n.tag==='div'&&n.children.includes(transfer));
 assert.ok(actionBar);
 assert.ok(actionBar.children.includes(review));
 assert.ok(actionBar.children.includes(clear));
 assert.ok(actionBar.style.cssText.includes('flex-wrap:wrap'));
 assert.ok(transferBar.style.cssText.includes('flex-wrap:wrap'));
});

test('backgrounding app invalidates reviewed Zalo draft without losing text',()=>{
 const t=setup(),p=prepare(t,'2dmn\n12b1.');
 assert.equal(p.transfer.disabled,false);
 t.background();
 assert.equal(p.transfer.disabled,true);
 assert.equal(p.field.value,'2dmn\n12b1.');
 p.transfer.fire('click');
 assert.equal(t.bets.value,'');
 t.foreground();
 t.find('Xem trước').fire('click');
 const check=t.nodes.find(n=>n.tag==='input');
 check.checked=true;check.fire('change');
 p.transfer.fire('click');
 assert.equal(t.bets.value,'2dmn\n12b1.');
});

test('clipboard paste cancellation preserves unsent Zalo draft',async()=>{
 const t=setup(),field=t.nodes.find(n=>n.tag==='textarea');
 field.value='draft message';field.fire('input');
 t.context.navigator={clipboard:{readText:async()=> 'replacement message'}};
 t.setConfirm(false);
 await t.find('Dán từ bộ nhớ tạm').fire('click');
 assert.equal(field.value,'draft message');
 assert.equal(t.bets.value,'');
 assert.equal(t.confirmCount(),1);
});
test('confirmed clipboard paste replaces draft only with consent',async()=>{
 const t=setup(),field=t.nodes.find(n=>n.tag==='textarea');
 field.value='draft message';field.fire('input');
 t.context.navigator={clipboard:{readText:async()=> 'replacement message'}};
 await t.find('Dán từ bộ nhớ tạm').fire('click');
 assert.equal(field.value,'replacement message');
 assert.equal(t.confirmCount(),1);
});
test('clipboard confirmation cannot overwrite draft after lock',async()=>{
 const t=setup(),field=t.nodes.find(n=>n.tag==='textarea');
 field.value='draft message';field.fire('input');
 t.context.navigator={clipboard:{readText:async()=> 'replacement message'}};
 t.context.confirm=()=>{t.lockWithoutObserver();return true;};
 await t.find('Dán từ bộ nhớ tạm').fire('click');
 assert.equal(field.value,'');
 assert.equal(t.bets.value,'');
});

test('chat bubble preview shows untrusted pasted text as text only',()=>{
 const t=setup(),input='<img src=x onerror=alert(1)>\n2dmn\n12b1.';
 prepare(t,input);
 const preview=t.nodes.find(n=>n.tag==='pre');
 assert.equal(preview.textContent,input);
 assert.equal(preview.hidden,false);
 assert.ok(preview.style.cssText.includes('border-radius:16px'));
 assert.ok(preview.style.cssText.includes('max-width:90%'));
 assert.equal(t.bets.value,'');
});

test('append copied Zalo messages preserves line breaks and requires review',async()=>{
 const t=setup();const field=t.nodes.find(n=>n.tag==='textarea');
 t.context.navigator={clipboard:{readText:async()=> '34.43da1.'}};
 field.value=['2dmn','12.21b5.'].join(String.fromCharCode(10));
 await t.find('Nối tin đã sao chép').fire('click');
 assert.equal(field.value,['2dmn','12.21b5.','34.43da1.'].join(String.fromCharCode(10)));
 assert.equal(t.bets.value,'');
 assert.equal(t.find('Đưa vào ô nhập phơi').disabled,true);
});

test('duplicate multiline Zalo block asks confirmation and can be cancelled',async()=>{
 const t=setup(),field=t.nodes.find(n=>n.tag==='textarea');
 const block=['2dmn','12.21b5.','34.43da1.'].join(String.fromCharCode(10));
 field.value=block;t.setConfirm(false);
 t.context.navigator={clipboard:{readText:async()=>block}};
 await t.find('Nối tin đã sao chép').fire('click');
 assert.equal(field.value,block);
 assert.equal(t.confirmCount(),1);
 assert.equal(t.bets.value,'');
});
test('confirmed repeated Zalo block is retained for intentional repeated bets',async()=>{
 const t=setup(),field=t.nodes.find(n=>n.tag==='textarea');
 const block=['2dmn','12.21b5.'].join(String.fromCharCode(10));
 field.value=block;
 t.context.navigator={clipboard:{readText:async()=>block}};
 await t.find('Nối tin đã sao chép').fire('click');
 assert.equal(field.value,[block,block].join(String.fromCharCode(10)));
 assert.equal(t.confirmCount(),1);
 assert.equal(t.bets.value,'');
});

test('pending Zalo append cannot restore a cleared draft',async()=>{
 const t=setup(),field=t.nodes.find(n=>n.tag==='textarea');
 let resolve;
 t.context.navigator={clipboard:{readText:()=>new Promise(r=>{resolve=r;})}};
 field.value='2dmn';
 const pending=t.find('Nối tin đã sao chép').fire('click');
 t.find('Xóa nội dung dán').fire('click');
 resolve('12b1.');
 await pending;
 assert.equal(field.value,'');
 assert.equal(t.bets.value,'');
});
test('Zalo append is rejected when app locks during clipboard read',async()=>{
 const t=setup(),field=t.nodes.find(n=>n.tag==='textarea');
 let resolve;
 t.context.navigator={clipboard:{readText:()=>new Promise(r=>{resolve=r;})}};
 field.value='2dmn';
 const pending=t.find('Nối tin đã sao chép').fire('click');
 t.lock();
 resolve('12b1.');
 await pending;
 assert.equal(field.value,'');
 assert.equal(t.bets.value,'');
});
test('Zalo append does not overwrite newer manual edits',async()=>{
 const t=setup(),field=t.nodes.find(n=>n.tag==='textarea');
 let resolve;
 t.context.navigator={clipboard:{readText:()=>new Promise(r=>{resolve=r;})}};
 field.value='2dmn';
 const pending=t.find('Nối tin đã sao chép').fire('click');
 field.value='3dmn';field.fire('input');
 resolve('12b1.');
 await pending;
 assert.equal(field.value,'3dmn');
 assert.equal(t.bets.value,'');
});

test('transfer refuses to merge into unfinished existing phoi',()=>{
 const t=setup();t.bets.value='2dmn\n12b1';
 prepare(t,'3dmn\n34b1.').transfer.fire('click');
 assert.equal(t.bets.value,'2dmn\n12b1');
 assert.equal(t.bets.events.length,0);
 assert.equal(t.confirmCount(),0);
});
test('transfer rejects changes to existing phoi made during confirmation',()=>{
 const t=setup();t.bets.value='2dmn\n12b1.';
 t.context.confirm=()=>{t.bets.value='2dmn\n99b1.';return true;};
 prepare(t,'3dmn\n34b1.').transfer.fire('click');
 assert.equal(t.bets.value,'2dmn\n99b1.');
 assert.equal(t.bets.events.length,0);
});
test('transfer requires new review after a background switch',()=>{
 const t=setup(),p=prepare(t,'2dmn\n12b1.');
 t.background();t.foreground();
 p.transfer.fire('click');
 assert.equal(t.bets.value,'');
 assert.equal(t.bets.events.length,0);
});

test('append preserves existing trailing blank lines and copied whitespace',async()=>{
 const t=setup(),field=t.nodes.find(n=>n.tag==='textarea');
 const newline=String.fromCharCode(10);
 field.value='2dmn'+newline+newline;
 t.context.navigator={clipboard:{readText:async()=> '  12b1.  '}};
 await t.find('Nối tin đã sao chép').fire('click');
 assert.equal(field.value,'2dmn'+newline+newline+'  12b1.  ');
 assert.equal(t.bets.value,'');
});
