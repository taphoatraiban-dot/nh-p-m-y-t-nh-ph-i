const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../../assets/telegram-chat/chat.js'),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,5));
async function setup(options={}){
 const d=new JSDOM('<div id="tgMemberInbox"></div><textarea id="bets">Phơi đang nhập</textarea>',{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=d.window,calls=[];let authChange;let groups=[{chat_id:-123,group_name:'Nhóm A'},{chat_id:456,group_name:'Cá nhân: B'}],signals=[];
 w.document.getElementById('bets').scrollIntoView=()=>{};
 w.sb={auth:{getSession:async()=>({data:{session:{access_token:'jwt',user:{id:'user-a'}}}}),onAuthStateChange:cb=>{authChange=cb;}}};w.SUPABASE_URL='https://test';w.SUPABASE_PUBLISHABLE_KEY='public';
 w.AudioContext=class{currentTime=0;destination={};async resume(){}createGain(){return{connect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}}}createOscillator(){return{connect(){},frequency:{},start(){calls.push({beep:true});},stop(){}}}};
 w.fetch=async(url,args)=>{const action=url.split('action=')[1],body=JSON.parse(args.body);calls.push({action,body,headers:args.headers});
  let result={success:true};if(action==='status')result.has_pin=options.hasPin??true;
  if(action==='unlock')result={success:true,ticket:'t'.repeat(72),expires_in:600};
  if(action==='read'&&options.readError)return{ok:false,status:403,json:async()=>({error:'Tài khoản chưa được bật Chat'})};
  if(action==='read')result={success:true,groups,jobs:options.jobs||[],notices:signals,messages:body.chat_id?[{chat_id:body.chat_id,message_id:1,message_text:'<img onerror="bad">\nTin nhận',message_date:'2026-11-09T06:00:00Z',sender_name:'Đã nhận'}]:[]};
  if(action==='send'){if(options.waitSend)await options.waitSend;if(options.sendFail){options.sendFail=false;throw Error('Mất kết nối');}result.job={state:'queued'};}
  return{ok:true,status:200,json:async()=>result};
 };
 w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await tick();
 const el=id=>w.document.getElementById('ottChat'+id),panel=el('');panel.open=true;await tick();
 const submit=async id=>{el(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();};
 async function unlock(){el('Pin').value='1234';el('Confirm').value='1234';await submit('Gate');}
 return{d,w,el,calls,submit,unlock,authChange:()=>authChange('SIGNED_OUT',null),signals:x=>{signals=x;},groups:x=>{groups=x;}};
}
test('PIN gate hides chat; setup confirms 4 digits and does not read before unlock',async()=>{
 const s=await setup({hasPin:false});try{assert(s.el('Unlocked').hidden);assert(!s.calls.some(c=>c.action==='read'));s.el('Pin').value='1234';s.el('Confirm').value='9999';await s.submit('Gate');assert(!s.calls.some(c=>c.action==='unlock'));await s.unlock();assert(!s.el('Unlocked').hidden);assert.equal(s.el('Pin').value,'');assert.equal(s.calls.find(c=>c.action==='unlock').body.create,true);}finally{s.d.window.close();}
});
test('group and personal conversations render safe text; import only appends to manual input',async()=>{
 const s=await setup();try{let detail;s.w.document.getElementById('bets').addEventListener('input',e=>detail=e.detail);await s.unlock();assert.equal(s.el('Conversations').children.length,2);s.el('Conversations').firstChild.click();await tick();assert.equal(s.el('Messages').querySelector('img'),null);s.el('Messages').querySelector('button').click();assert.equal(s.w.document.getElementById('bets').value,'Phơi đang nhập\n<img onerror="bad">\nTin nhận');assert(!s.calls.some(c=>c.action==='send'));assert.equal(detail.ottChatManualImport,true);}finally{s.d.window.close();}
});
test('lost send response preserves draft and request UUID on retry',async()=>{
 const s=await setup({sendFail:true});try{await s.unlock();s.el('Conversations').firstChild.click();await tick();s.el('Text').value='Tin gửi';await s.submit('Compose');assert.equal(s.el('Text').value,'Tin gửi');await s.submit('Compose');const sent=s.calls.filter(c=>c.action==='send');assert.equal(sent.length,2);assert.equal(sent[0].body.id,sent[1].body.id);assert.equal(s.el('Text').value,'');}finally{s.d.window.close();}
});
test('lock and signout clear loaded content and drafts',async()=>{
 const s=await setup();try{await s.unlock();s.el('Conversations').firstChild.click();await tick();s.el('Text').value='Riêng tư';s.authChange();assert(s.el('Unlocked').hidden);assert.equal(s.el('Messages').textContent,'');assert.equal(s.el('Text').value,'');}finally{s.d.window.close();}
});
test('sound is opt-in and does not alert on initial history or outgoing messages',async()=>{
 const s=await setup();try{s.signals([{chat_id:-123,message_id:1,sender_name:'Đã nhận'}]);await s.unlock();assert(!s.calls.some(c=>c.beep));s.el('Sound').click();await tick();let n=s.calls.filter(c=>c.beep).length;s.el('Refresh').click();await tick();assert.equal(s.calls.filter(c=>c.beep).length,n);s.signals([{chat_id:-123,message_id:2,sender_name:'Đã nhận'}]);s.el('Refresh').click();await tick();assert.equal(s.calls.filter(c=>c.beep).length,n+1);s.el('Refresh').click();await tick();assert.equal(s.calls.filter(c=>c.beep).length,n+1);}finally{s.d.window.close();}
});

test('Chat assets are loaded once outside the legacy print document string',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 assert.equal((html.match(/src="assets\/telegram-chat\/chat\.js(?:\?[^"]*)?"/g)||[]).length,1);
 assert(html.lastIndexOf('src="assets/telegram-chat/chat.js')>html.lastIndexOf('w.document.close'));
});

test('confirmed send clears only its own draft after changing conversation',async()=>{
 let finish;const waitSend=new Promise(r=>finish=r);const s=await setup({waitSend});
 try{await s.unlock();s.el('Conversations').firstChild.click();await tick();s.el('Text').value='Đang gửi';await s.submit('Compose');s.el('Conversations').children[1].click();await tick();s.el('Text').value='Bản nháp khác';finish();await tick();assert.equal(s.el('Text').value,'Bản nháp khác');s.el('Conversations').firstChild.click();await tick();assert.equal(s.el('Text').value,'');}finally{s.d.window.close();}
});
test('manual Chat import cancels automatic calculation while normal typing still schedules it',()=>{
 const vm=require('node:vm'),html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const a=html.indexOf("$('bets').addEventListener('input',function(e){"),b=html.indexOf("$('pasteAll').onclick",a);assert(a>0&&b>a);
 let handler,scheduled=[],cleared=0,calculated=0;const context={__phoiInputTimer:17,__phoiPasting:false,$:()=>({addEventListener:(kind,fn)=>handler=fn}),clearTimeout:()=>cleared++,setTimeout:fn=>{scheduled.push(fn);return scheduled.length},autoReadPhoi:()=>calculated++};
 vm.runInNewContext(html.slice(a,b),context);handler({detail:{ottChatManualImport:true}});assert.equal(cleared,1);assert.equal(scheduled.length,0);handler({});assert.equal(scheduled.length,1);scheduled[0]();assert.equal(calculated,1);
});

test('access revoked while reading clears previously loaded Chat content',async()=>{
 const options={},s=await setup(options);try{await s.unlock();s.el('Conversations').firstChild.click();await tick();assert(s.el('Messages').querySelector('article'));options.readError=true;s.el('Refresh').click();await tick();assert(s.el('Unlocked').hidden);assert.equal(s.el('Messages').textContent,'');}finally{s.d.window.close();}
});
test('an uncertain Telegram receipt tells the user to check the original before resending',async()=>{
 const s=await setup({jobs:[{id:'test',chat_id:-123,message_text:'Tin chưa xác nhận',state:'failed',error:'RECEIPT_UNCERTAIN',created_at:'2026-11-09T06:00:00Z'}]});
 try{await s.unlock();s.el('Conversations').firstChild.click();await tick();assert(s.el('Messages').textContent.includes('kiểm tra tin gốc trên Telegram trước khi gửi lại'));assert(!s.el('Messages').textContent.includes('RECEIPT_UNCERTAIN'));}finally{s.d.window.close();}
});
