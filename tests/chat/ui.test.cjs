const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../../assets/telegram-chat/chat.js'),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,5));
async function setup(options={}){
 const d=new JSDOM('<section id="appCard"><aside id="appDrawer" aria-hidden="true"><button id="drawerClose">×</button><div id="tgMemberInbox"></div></aside><div id="drawerBackdrop"></div></section><textarea id="bets">Phơi đang nhập</textarea>',{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=d.window,calls=[];if(options.soundPref)w.localStorage.setItem('ott_chat_sound:user-a',options.soundPref);const hidden=options.hidden||new Set();let authChange;let groups=[{chat_id:-123,group_name:'Nhóm A'},{chat_id:456,group_name:'Cá nhân: B'}],signals=[];
 w.document.getElementById('bets').scrollIntoView=()=>{};
 w.sb={auth:{getSession:async()=>({data:{session:{access_token:'jwt',user:{id:'user-a'}}}}),onAuthStateChange:cb=>{authChange=cb;}}};w.SUPABASE_URL='https://test';w.SUPABASE_PUBLISHABLE_KEY='public';
 w.AudioContext=class{currentTime=0;destination={};async resume(){}createGain(){return{connect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}}}createOscillator(){return{connect(){},frequency:{},start(){calls.push({beep:true});},stop(){}}}};
 w.fetch=async(url,args)=>{const action=url.split('action=')[1],body=JSON.parse(args.body);calls.push({action,body,headers:args.headers});
  let result={success:true};if(action==='status')result.has_pin=options.hasPin??true;
  if(action==='unlock')result={success:true,ticket:'t'.repeat(72),expires_in:600};
  if(action==='read'&&options.readError)return{ok:false,status:403,json:async()=>({error:'Tài khoản chưa được bật Chat'})};
  if(action==='hide'){if(options.hideError)return{ok:false,status:500,json:async()=>({error:'Không ẩn được'})};body.message_ids.forEach(id=>hidden.add(body.chat_id+':'+id));}
  if(action==='read')result={success:true,groups,jobs:options.jobs||[],notices:signals,messages:body.chat_id?[{chat_id:body.chat_id,message_id:1,message_text:'<img onerror="bad">\nTin nhận',message_date:'2026-11-09T06:00:00Z',sender_name:'Đã nhận'},...(options.extraMessages||[])].filter(m=>!hidden.has(body.chat_id+':'+m.message_id)):[]};
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
 const s=await setup({soundPref:'off'});try{s.signals([{chat_id:-123,message_id:1,sender_name:'Đã nhận'}]);await s.unlock();assert(!s.calls.some(c=>c.beep));s.el('Sound').click();await tick();let n=s.calls.filter(c=>c.beep).length;s.el('Refresh').click();await tick();assert.equal(s.calls.filter(c=>c.beep).length,n);s.signals([{chat_id:-123,message_id:2,sender_name:'Đã nhận'}]);s.el('Refresh').click();await tick();assert.equal(s.calls.filter(c=>c.beep).length,n+1);s.el('Refresh').click();await tick();assert.equal(s.calls.filter(c=>c.beep).length,n+1);}finally{s.d.window.close();}
});

test('Chat assets are loaded once outside the legacy print document string',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 assert.equal((html.match(/src="assets\/telegram-chat\/chat(?:\.[a-f0-9]{12})?\.js(?:\?[^"]*)?"/g)||[]).length,1);
 assert(html.lastIndexOf('src="assets/telegram-chat/chat.')>html.lastIndexOf('w.document.close'));
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

test('sound preference remains enabled until explicitly switched off',async()=>{
 const s=await setup();try{await s.unlock();assert.equal(s.el('Sound').textContent,'Tắt âm báo');s.el('Sound').click();await tick();assert.equal(s.w.localStorage.getItem('ott_chat_sound:user-a'),'off');s.el('Refresh').click();await tick();assert.equal(s.el('Sound').textContent,'Bật âm báo');s.el('Sound').click();await tick();assert.equal(s.w.localStorage.getItem('ott_chat_sound:user-a'),'on');}finally{s.d.window.close();}
});

test('selection cancels without changes, requires visible confirmation, persists after reload',async()=>{
 const hidden=new Set(),options={hidden,extraMessages:[{message_id:2,message_text:'Tin 2',message_date:'2026-11-09T06:01:00Z'}]},s=await setup(options);
 try{await s.unlock();s.el('Conversations').firstChild.click();await tick();s.el('Select').click();let boxes=s.el('Messages').querySelectorAll('input');boxes[0].click();boxes[1].click();assert.equal(s.el('Delete').textContent,'Xóa tin đã chọn (2)');s.el('Cancel').click();assert.equal(hidden.size,0);s.el('Select').click();s.el('Messages').querySelector('input').click();s.el('Delete').click();assert.equal(s.el('DeleteConfirm').hidden,false);assert(!s.calls.some(c=>c.action==='hide'));s.el('Keep').click();assert(s.el('DeleteConfirm').hidden);s.el('Messages').querySelectorAll('input')[1].click();s.el('Delete').click();s.el('ConfirmDelete').click();await tick();assert.equal(hidden.size,2);assert.equal(s.el('Messages').querySelectorAll('article').length,0);s.el('Refresh').click();await tick();assert.equal(s.el('Messages').querySelectorAll('article').length,0);
 }finally{s.d.window.close();}
 const reloaded=await setup(options);try{await reloaded.unlock();reloaded.el('Conversations').firstChild.click();await tick();assert.equal(reloaded.el('Messages').querySelectorAll('article').length,0);}finally{reloaded.d.window.close();}
});
test('hide failure preserves selection; locking clears confirmation and content',async()=>{
 const s=await setup({hideError:true});try{await s.unlock();s.el('Conversations').firstChild.click();await tick();s.el('Select').click();s.el('Messages').querySelector('input').click();s.el('Delete').click();s.el('ConfirmDelete').click();await tick();assert(s.el('Messages').querySelector('input').checked);assert(!s.el('Delete').disabled);s.el('Delete').click();s.el('Lock').click();assert(s.el('DeleteConfirm').hidden);assert.equal(s.el('Messages').textContent,'');}finally{s.d.window.close();}
});
test('deployed Chat URLs match content hashes and canonical source',()=>{
 const crypto=require('node:crypto'),html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 for(const ext of ['js','css']){const source=fs.readFileSync(path.join(__dirname,'../../assets/telegram-chat/chat.'+ext));const hash=crypto.createHash('sha256').update(source).digest('hex').slice(0,12),name='assets/telegram-chat/chat.'+hash+'.'+ext;assert(html.includes(name));assert.deepEqual(fs.readFileSync(path.join(__dirname,'../../',name)),source);}
});

test('direct desktop Chat entry opens drawer but still requires PIN',async()=>{
 const s=await setup();try{const launch=s.w.document.getElementById('ottChatOpen');assert(launch);s.el('').open=false;await tick();s.el('').scrollIntoView=()=>{};launch.click();assert(!s.w.document.getElementById('appDrawer').classList.contains('open'));s.w.document.body.classList.add('app-unlocked');s.w.document.addEventListener('click',e=>{const drawer=s.w.document.getElementById('appDrawer');if(!drawer.contains(e.target)){drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');}});const clone=launch.cloneNode(true);launch.replaceWith(clone);const panelClone=s.el('').cloneNode(true);panelClone.scrollIntoView=()=>{};s.el('').replaceWith(panelClone);clone.click();await tick();assert(s.w.document.getElementById('appDrawer').classList.contains('open'));assert.equal(s.w.document.getElementById('appDrawer').getAttribute('aria-hidden'),'false');assert(s.el('').open);assert(s.el('Unlocked').hidden);assert(!s.calls.some(c=>c.action==='read'));s.w.document.getElementById('drawerClose').click();assert(!s.w.document.getElementById('appDrawer').classList.contains('open'));assert(!s.w.document.getElementById('drawerBackdrop').classList.contains('open'));}finally{s.d.window.close();}
});

test('legacy swipe hint cleanup cannot hide the application container and Chat entry',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8'),script=html.match(/<script id="tsh-wheel-one-item-fix-js">([\s\S]*?)<\/script>/)[1];
 const d=new JSDOM('<div class="wrap"><section id="appCard"><button id="ottChatOpen">Chat</button><p>☝ VUỐT TỪ MÉP TRÁI VÀO ĐỂ MỞ MENU</p></section></div>',{runScripts:'outside-only'});
 try{d.window.eval(script);d.window.dispatchEvent(new d.window.Event('DOMContentLoaded'));assert(!d.window.document.querySelector('.wrap').classList.contains('tsh-swipe-tip-hide'));assert(!d.window.document.getElementById('appCard').classList.contains('tsh-swipe-tip-hide'));assert(d.window.document.querySelector('p').classList.contains('tsh-swipe-tip-hide'));}finally{d.window.close();}
});


test('conversation search initializes without ReferenceError and filters groups',async()=>{
 const s=await setup();try{
  await s.unlock();
  assert.equal(s.el('Conversations').children.length,2);
  s.el('Search').value='B';
  s.el('Search').dispatchEvent(new s.w.Event('input',{bubbles:true}));
  assert.equal(s.el('Conversations').children.length,1);
  assert.match(s.el('Conversations').textContent,/Cá nhân: B/);
  s.el('Search').value='';
  s.el('Search').dispatchEvent(new s.w.Event('input',{bubbles:true}));
  assert.equal(s.el('Conversations').children.length,2);
 }finally{s.d.window.close();}
});
