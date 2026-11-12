/* Telegram Chat experiment: independent from the existing inbox and money/print code. */
(function(){
'use strict';
function init(){
 const anchor=document.getElementById('tgMemberInbox')||document.getElementById('tgForwardInbox');
 if(!anchor||document.getElementById('ottChat'))return;
 const panel=document.createElement('details');panel.id='ottChat';
 panel.innerHTML='<summary>💬 Telegram Chat</summary><p id="ottChatStatus" role="status">Mở khóa để xem hội thoại.</p><form id="ottChatGate"><div class="ott-chat-row"><input id="ottChatPin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" aria-label="PIN Chat 4 số" placeholder="PIN Chat 4 số" required><input id="ottChatConfirm" type="password" inputmode="numeric" maxlength="4" autocomplete="off" aria-label="Xác nhận PIN Chat" placeholder="Nhập lại PIN mới" hidden><button id="ottChatUnlock" type="submit">Mở Chat</button></div></form><div id="ottChatUnlocked" hidden><div class="ott-chat-row"><select id="ottChatMode" aria-label="Loại hội thoại"><option value="all">Tất cả hội thoại</option><option value="group">Nhóm</option><option value="private">Cá nhân</option></select><button id="ottChatSound" type="button">Bật âm báo</button><button id="ottChatRefresh" type="button">Làm mới</button><button id="ottChatLock" type="button">Khóa Chat</button></div><div id="ottChatSearchWrap"><input id="ottChatSearch" type="search" placeholder="Tìm người hoặc nhóm…" aria-label="Tìm hội thoại"><div id="ottChatTabs" class="ott-chat-row"><button type="button" data-mode="private">Cá nhân</button><button type="button" data-mode="group">Nhóm</button><button type="button" data-mode="all">Tất cả</button></div></div><div id="ottChatBody"><nav id="ottChatConversations" aria-label="Danh sách hội thoại"></nav><div id="ottChatThread"><div class="ott-chat-row"><button id="ottChatBack" type="button">← Trở lại</button><strong id="ottChatHeading">Chọn hội thoại</strong></div><div class="ott-chat-row" id="ottChatDeleteTools"><button type="button" id="ottChatSelect">Chọn tin</button><button type="button" id="ottChatSelectAll">Chọn tất cả</button><button type="button" id="ottChatCopy">Sao chép (0)</button><button type="button" id="ottChatDelete" hidden>Xóa tin đã chọn (0)</button><button type="button" id="ottChatCancel" hidden>Hủy chọn</button></div><div id="ottChatDeleteConfirm" role="dialog" aria-modal="true" aria-label="Xác nhận ẩn tin" hidden><p id="ottChatDeleteQuestion"></p><div class="ott-chat-row"><button type="button" id="ottChatConfirmDelete">Xóa khỏi CUNCUN</button><button type="button" id="ottChatKeep">Giữ lại</button></div></div><div id="ottChatMessages" aria-label="Tin nhắn"></div><form id="ottChatCompose"><textarea id="ottChatText" maxlength="4096" aria-label="Nội dung tin nhắn" placeholder="Nhập tin nhắn Telegram…" required></textarea><div class="ott-chat-row"><button id="ottChatSend" type="button">Gửi Telegram</button><small>Đưa tin vào nhập phơi để kiểm tra thủ công.</small></div></form></div></div></div>';
 const controls=panel.querySelector('#ottChatUnlocked>.ott-chat-row');
 if(controls){
  const refresh=panel.querySelector('#ottChatRefresh');
  refresh.textContent='↻';refresh.title='Làm mới';refresh.setAttribute('aria-label','Làm mới');
  const menu=document.createElement('details');menu.id='ottChatMenu';
  const toggle=document.createElement('summary');toggle.textContent='⋯';toggle.setAttribute('aria-label','Tùy chọn Chat');
  menu.append(toggle,panel.querySelector('#ottChatSound'),panel.querySelector('#ottChatLock'));
  controls.append(refresh,menu);
  const notify=document.createElement('button');notify.id='ottChatNotification';notify.type='button';
  notify.textContent='Thông báo';notify.title='Bật thông báo khi đóng phần mềm';
  notify.onclick=()=>{
   const original=[...document.querySelectorAll('button')].find(b=>b!==notify&&/bật báo tin khi đóng pm|bật thông báo khi đóng/i.test(b.textContent||''));
   if(original)original.click();else status('Không tìm thấy chức năng bật thông báo.');
  };
  controls.append(notify);
 }
 anchor.after(panel);
 const host=document.getElementById('appCard');
 if(host){
  const launch=document.createElement('button');launch.id='ottChatOpen';launch.type='button';launch.textContent='💬 Telegram Chat';launch.setAttribute('aria-controls','ottChat');
  document.addEventListener('click',e=>{
   if(e.target.closest?.('#drawerClose')){
    document.getElementById('appDrawer')?.classList.remove('open');
    document.getElementById('appDrawer')?.setAttribute('aria-hidden','true');
    document.getElementById('drawerBackdrop')?.classList.remove('open');
    return;
   }
   if(!e.target.closest?.('#ottChatOpen'))return;
   e.preventDefault();e.stopPropagation();
   if(!document.body.classList.contains('app-unlocked'))return;
   const currentPanel=document.getElementById('ottChat'),currentHost=document.getElementById('appCard');if(!currentPanel)return;
   const drawer=document.getElementById('appDrawer');if(drawer){drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');document.getElementById('drawerBackdrop')?.classList.add('open');}
   for(let parent=currentPanel.parentElement;parent&&parent!==currentHost;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
   currentPanel.open=true;currentPanel.scrollIntoView({behavior:'smooth',block:'center'});
  },true);
  host.prepend(launch);
 }

 const el=id=>panel.querySelector('#ottChat'+id),status=t=>{el('Status').textContent=t;};
 let ticket='',userId='',expires=0,epoch=0,hasPin=true,busy=false,sending=false,chatId=null,groups=[],jobs=[],messages=[],seen=new Set(),baseline=false,audio=null,sound=true;
 let selecting=false,deleting=false,swipedChatId=null;const selected=new Set();
 const pending=new Map();
 const drafts=new Map();
 const expandedImports=new Set();
 const readKeys=new Map();let latestNotices=[];
 function readStoreKey(id){return 'ott_chat_read:'+userId+':'+id;}
 function readCursor(id){if(!readKeys.has(id)){let n=0;try{n=Number(localStorage.getItem(readStoreKey(id)))||0;}catch{}readKeys.set(id,n);}return readKeys.get(id)||0;}
 function markRead(id){if(id===null||!userId)return;const max=latestNotices.filter(m=>String(m.chat_id)===String(id)).reduce((n,m)=>Math.max(n,Number(m.message_id)||0),readCursor(id));readKeys.set(id,max);try{localStorage.setItem(readStoreKey(id),String(max));}catch{}}
 function unreadCount(id){const cursor=readCursor(id);return latestNotices.filter(m=>String(m.chat_id)===String(id)&&Number(m.message_id)>cursor&&m.sender_name!=='Đã gửi').length;}
 async function api(action,body={},proof=ticket){
  const {data:{session}}=await sb.auth.getSession();
  if(!session)throw Object.assign(Error('Cần đăng nhập phần mềm'),{status:401});
  if(userId&&session.user.id!==userId){lock(false);throw Error('Tài khoản đã thay đổi');}
  userId=session.user.id;restoreSound(userId);
  const res=await fetch(SUPABASE_URL+'/functions/v1/telegram-chat?action='+action,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json','x-chat-ticket':proof},body:JSON.stringify(body)});
  const data=await res.json();if(!res.ok||!data.success)throw Object.assign(Error(data.error||'Không thể kết nối Chat'),{status:res.status});return data;
 }
 function lock(revoke=true){
  const previous=ticket;if(revoke&&previous)api('lock',{},previous).catch(()=>{});
  el('DeleteConfirm').hidden=true;epoch++;ticket='';expires=0;chatId=null;groups=[];messages=[];jobs=[];seen.clear();baseline=false;latestNotices=[];readKeys.clear();drafts.clear();pending.clear();selected.clear();selecting=false;updateDeleteTools();
  view();el('Text').value='';el('Pin').value='';el('Confirm').value='';el('Messages').replaceChildren();el('Conversations').replaceChildren();
  el('Unlocked').hidden=true;el('Gate').hidden=false;status('Chat đã khóa. Nhập PIN để mở lại.');
 }
 function fail(e){if([401,403,423].includes(e.status))lock(false);status(e.message||'Không thể kết nối Chat');}
 function restoreSound(uid){try{sound=localStorage.getItem('ott_chat_sound:'+uid)!=='off';}catch{}el('Sound').textContent=sound?'Tắt âm báo':'Bật âm báo';el('Sound').setAttribute('aria-pressed',String(sound));}
 function resumeSound(){if(!sound)return;try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}}
 document.addEventListener('pointerdown',resumeSound);document.addEventListener('keydown',resumeSound);
 function beep(){if(!sound||!audio)return;try{const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=880;g.gain.setValueAtTime(.32,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);o.start();o.stop(audio.currentTime+.18);}catch{}}
 function modeGroups(){return groups.filter(g=>(el('Mode').value==='all'||(String(g.group_name).startsWith('Cá nhân: ')?'private':'group')===el('Mode').value)&&String(g.group_name).toLocaleLowerCase('vi').includes((el('Search')?.value||'').toLocaleLowerCase('vi').trim()));}
 function view(){panel.classList.toggle('ott-chat-thread-open',chatId!==null);el('SearchWrap').hidden=chatId!==null;el('Back').hidden=chatId===null;for(const b of el('Tabs').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.mode===el('Mode').value));}
 function updateDeleteTools(){
  el('Select').disabled=chatId===null||deleting;el('Select').hidden=selecting;el('Delete').hidden=!selecting;el('Cancel').hidden=!selecting;el('SelectAll').hidden=chatId===null;el('Copy').hidden=chatId===null;
  const available=messages.filter(m=>Number.isSafeInteger(m.message_id));
  const all=available.length>0&&available.every(m=>selected.has(m.message_id));
  el('SelectAll').textContent=all?'Bỏ chọn tất cả':'Chọn tất cả';el('SelectAll').disabled=deleting||!available.length;
  el('Copy').textContent='Sao chép ('+selected.size+')';el('Copy').disabled=deleting||!selected.size;
  el('Delete').textContent='Xóa tin đã chọn ('+selected.size+')';el('Delete').disabled=deleting||!selected.size;el('Cancel').disabled=deleting;
 }
 async function clearConversation(target,name){
  if(deleting||!ticket)return;
  deleting=true;const proof=ticket;
  try{
   await api('clear-chat',{chat_id:target});
   if(ticket!==proof)return;
   if(chatId===target){chatId=null;messages=[];selected.clear();selecting=false;el('Text').value='';}
   jobs=jobs.filter(j=>j.chat_id!==target);
   epoch++;draw();await load();
   status('Đã xóa tin nhắn của '+name+' khỏi CUNCUN. Telegram gốc không thay đổi.');
  }catch(e){if(ticket===proof)fail(e);}
  finally{deleting=false;updateDeleteTools();}
 }
 function draw(){
  updateDeleteTools();const list=el('Conversations');list.replaceChildren();
  for(const g of modeGroups()){
   const b=document.createElement('button');b.type='button';b.textContent=g.group_name;const unread=unreadCount(g.chat_id);if(unread){const badge=document.createElement('span');badge.className='ott-chat-unread';badge.textContent=String(unread);badge.setAttribute('aria-label',unread+' tin chưa đọc');b.append(' ',badge);}b.setAttribute('aria-pressed',String(g.chat_id===chatId));
   const wrap=document.createElement('div');wrap.className='ott-chat-swipe-row';if(swipedChatId===g.chat_id)wrap.classList.add('swiped');
   const remove=document.createElement('button');remove.type='button';remove.className='ott-chat-swipe-delete';remove.textContent='Xóa';
   remove.setAttribute('aria-label','Xóa toàn bộ tin của '+g.group_name);
   remove.onclick=()=>{swipedChatId=null;wrap.classList.remove('swiped');if(deleting)return;
    if(!confirm('Xóa toàn bộ tin nhắn của '+g.group_name+' khỏi CUNCUN? Telegram gốc không thay đổi.'))return;
    clearConversation(g.chat_id,g.group_name);
   };
   let startX=0,startY=0,swiping=false,suppress=false;
   b.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;startX=e.touches[0].clientX;startY=e.touches[0].clientY;swiping=false;},{passive:true});
   b.addEventListener('touchend',e=>{if(!e.changedTouches.length)return;
    const dx=e.changedTouches[0].clientX-startX,dy=e.changedTouches[0].clientY-startY;
    if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.3){swiping=true;suppress=true;swipedChatId=dx<0?g.chat_id:null;wrap.classList.toggle('swiped',dx<0);}
   },{passive:true});
   b.onclick=()=>{if(suppress){suppress=false;return;}if(deleting)return;if(chatId!==null)drafts.set(chatId,el('Text').value);el('DeleteConfirm').hidden=true;chatId=g.chat_id;markRead(chatId);epoch++;messages=[];selected.clear();selecting=false;updateDeleteTools();el('Text').value=drafts.get(chatId)||'';draw();load();};
   wrap.append(b,remove);list.append(wrap);
  }
  if(!list.children.length)list.textContent='Chưa có hội thoại được đồng bộ.';
  el('Heading').textContent=groups.find(g=>g.chat_id===chatId)?.group_name||'Chọn hội thoại';
  el('Send').disabled=sending;view();
  const root=el('Messages'),atBottom=root.scrollHeight-root.clientHeight-root.scrollTop<45,oldScroll=root.scrollTop;
  root.replaceChildren();
  const sentIds=new Set(jobs.filter(j=>j.chat_id===chatId&&j.state==='sent').map(j=>j.message_id));
  const rows=messages.map(m=>({...m,text:m.message_text,state:(m.sender_name==='Đã gửi'||sentIds.has(m.message_id))?'Đã gửi':'Đã nhận',out:sentIds.has(m.message_id),date:m.message_date}));
  for(const j of jobs.filter(j=>j.chat_id===chatId&&!(j.state==='sent'&&messages.some(m=>m.message_id===j.message_id))))rows.push({...j,text:j.message_text,state:j.error==='RECEIPT_UNCERTAIN'?'Chưa xác nhận — kiểm tra tin gốc trên Telegram trước khi gửi lại':({queued:'Chờ VPS gửi',sending:'Đang gửi',sent:'Đã gửi',failed:'Gửi thất bại'})[j.state]+(j.error?' · '+j.error:''),date:j.created_at,out:true});
  rows.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  for(const m of rows){
   const item=document.createElement('article');item.className='ott-chat-message';item.dataset.outgoing=String(m.out||m.sender_name==='Đã gửi');
   const meta=document.createElement('small');meta.textContent=m.state+' · '+new Date(m.date).toLocaleString('vi-VN')+(m.edited_at?' · Đã sửa':'');
   const p=document.createElement('p');p.textContent=m.text;
   const b=document.createElement('button');b.type='button';b.textContent='↳ Nhập phơi';b.title='Đưa nội dung tin nhắn vào ô nhập phơi thủ công';b.setAttribute('aria-label','Đưa vào nhập phơi thủ công');b.onclick=()=>{
    const box=document.getElementById('bets');if(!box){status('Không tìm thấy ô nhập phơi');return;}
    if(!m.text||!m.text.trim()){status('Tin nhắn này không có nội dung chữ để nhập phơi.');return;}
    box.value=(box.value.trim()?box.value.replace(/\s*$/,'')+'\n':'')+m.text;
    box.dispatchEvent(new CustomEvent('input',{bubbles:true,detail:{ottChatManualImport:true}}));
    box.dispatchEvent(new Event('change',{bubbles:true}));
    expandedImports.delete(importKey);b.hidden=true;
    box.focus();box.scrollIntoView({behavior:'smooth',block:'center'});status('Đã đưa tin vào ô nhập phơi. Kiểm tra trước khi tính tiền.');
   };
   if(selecting&&Number.isSafeInteger(m.message_id)&&messages.some(x=>x.message_id===m.message_id)){
    const label=document.createElement('label');label.className='ott-chat-select';
    const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(m.message_id);
    check.setAttribute('aria-label','Chọn tin nhắn để xóa');
    check.onchange=()=>{if(check.checked)selected.add(m.message_id);else selected.delete(m.message_id);updateDeleteTools();};
    check.disabled=deleting;label.append(check,document.createTextNode(' Chọn tin'));item.dataset.messageId=String(m.message_id);item.prepend(label);
   }
   const importKey=String(chatId)+':'+String(m.message_id??m.id??m.date??m.text);
   b.hidden=!expandedImports.has(importKey);b.classList.add('ott-chat-import');
   item.addEventListener('click',event=>{
    if(event.target.closest('button,input,label')||selecting)return;
    if(expandedImports.has(importKey)){expandedImports.delete(importKey);b.hidden=true;}
    else{expandedImports.add(importKey);b.hidden=false;}
   });
   item.append(meta,p,b);root.append(item);
  }
  if(!rows.length)root.textContent=chatId===null?'Chọn một hội thoại để xem tin.':'Chưa có tin nhắn trong hội thoại.';
  root.scrollTop=atBottom?root.scrollHeight:oldScroll;
 }
 async function load(){
  if(!ticket||busy||deleting||!el('DeleteConfirm').hidden||document.hidden||!panel.open)return;
  if(Date.now()>=expires){lock();return;}
  busy=true;const version=epoch;
  try{
   const fresh=await api('read',chatId===null?{}:{chat_id:chatId});if(version!==epoch||!ticket)return;
   groups=fresh.groups;jobs=fresh.jobs;messages=fresh.messages;
   if(chatId!==null&&!groups.some(g=>g.chat_id===chatId)){chatId=null;messages=[];}
   const signals=fresh.notices||[];latestNotices=signals;if(chatId!==null)markRead(chatId);
   if(baseline&&signals.some(m=>!seen.has(m.chat_id+':'+m.message_id)&&m.sender_name!=='Đã gửi'&&!jobs.some(j=>j.state==='sent'&&j.chat_id===m.chat_id&&j.message_id===m.message_id)))beep();
   for(const m of signals)seen.add(m.chat_id+':'+m.message_id);baseline=true;
   if(seen.size>5000)seen=new Set(signals.map(m=>m.chat_id+':'+m.message_id));
   draw();status('');
  }catch(e){if(version===epoch)fail(e);}finally{busy=false;}
 }
 async function gate(){const version=epoch;try{const x=await api('status');if(version!==epoch)return;hasPin=x.has_pin;el('Confirm').hidden=hasPin;el('Unlock').textContent=hasPin?'Mở Chat':'Tạo PIN & mở Chat';status(hasPin?'Nhập PIN Chat 4 số.':'Tạo PIN Chat 4 số và nhập lại để xác nhận.');}catch(e){fail(e);}}
 el('Gate').onsubmit=async e=>{e.preventDefault();if(el('Unlock').disabled)return;const pin=el('Pin').value;if(!/^\d{4}$/.test(pin)){status('PIN phải đúng 4 số');return;}if(!hasPin&&pin!==el('Confirm').value){status('Hai lần nhập PIN không khớp');return;}
  el('Unlock').disabled=true;const version=epoch;
  try{const x=await api('unlock',{pin,create:!hasPin});if(version!==epoch)return;ticket=x.ticket;expires=Date.now()+x.expires_in*1000;el('Pin').value='';el('Confirm').value='';el('Gate').hidden=true;el('Unlocked').hidden=false;await load();}catch(err){fail(err);}finally{el('Unlock').disabled=false;}
 };
 async function sendTelegram(e){if(e){e.preventDefault();e.stopPropagation();}status('Đang kiểm tra yêu cầu gửi Telegram…');if(sending){status('Tin trước đang gửi, vui lòng đợi phản hồi.');return;}if(chatId===null||!ticket){status('Hãy mở khóa và chọn hội thoại trước khi gửi.');return;}const text=el('Text').value;if(!text.trim()){status('Hãy nhập nội dung tin nhắn.');return;}
  // Keep UUID after a lost response so pressing Send retries the same job.
  if(!pending.has(chatId)||pending.get(chatId).text!==text)pending.set(chatId,{id:crypto.randomUUID(),chat_id:chatId,text});
  const job=pending.get(chatId),version=epoch,proof=ticket;sending=true;el('Send').disabled=true;status('Đang gửi tới máy chủ Telegram…');
  try{const x=await api('send',job);if(ticket!==proof)return;if(chatId===job.chat_id&&el('Text').value===text)el('Text').value='';if(drafts.get(job.chat_id)===text)drafts.delete(job.chat_id);pending.delete(job.chat_id);if(version!==epoch)return;status(x.job.state==='sent'?'Đã gửi':'Đã xếp hàng gửi. Chờ xác nhận từ Telegram.');await load();}catch(err){if(version===epoch)fail(err);}finally{sending=false;el('Send').disabled=false;}
 }
 el('Send').disabled=false;
 el('Send').addEventListener('click',sendTelegram);
 el('Compose').addEventListener('submit',sendTelegram);
 el('Sound').onclick=async()=>{try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();sound=!sound;try{localStorage.setItem('ott_chat_sound:'+userId,sound?'on':'off');}catch{}el('Sound').textContent=sound?'Tắt âm báo':'Bật âm báo';el('Sound').setAttribute('aria-pressed',String(sound));if(sound)beep();}catch{status('Trình duyệt chưa cho phép âm thanh. Hãy thử lại.');}};
 el('Select').onclick=()=>{if(chatId===null){status('Hãy chọn hội thoại trước');return;}selecting=true;selected.clear();updateDeleteTools();draw();};
 el('SelectAll').onclick=()=>{
  if(chatId===null||deleting)return;
  if(!selecting){selecting=true;selected.clear();}
  const available=messages.filter(m=>Number.isSafeInteger(m.message_id));
  const all=available.length>0&&available.every(m=>selected.has(m.message_id));
  if(all)selected.clear();else for(const m of available)selected.add(m.message_id);
  draw();
 };
 el('Copy').onclick=async()=>{
  const text=messages.filter(m=>selected.has(m.message_id)).map(m=>m.message_text||'').filter(Boolean).join('\n\n');
  if(!text){status('Không có nội dung chữ để sao chép.');return;}
  try{
   if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
   else throw Error('clipboard unavailable');
   status('Đã sao chép '+selected.size+' tin nhắn.');
  }catch(e){
   const field=document.createElement('textarea');field.value=text;field.setAttribute('readonly','');
   field.style.cssText='position:fixed;left:0;top:0;opacity:0;z-index:-1';document.body.append(field);
   field.focus();field.select();field.setSelectionRange(0,field.value.length);
   let ok=false;try{ok=document.execCommand('copy');}catch{}
   field.remove();status(ok?'Đã sao chép '+selected.size+' tin nhắn.':'Không thể sao chép tự động. Hãy thử mở bằng Safari.');
  }
 };
 el('Cancel').onclick=()=>{el('DeleteConfirm').hidden=true;selecting=false;selected.clear();updateDeleteTools();draw();};
 el('Delete').onclick=()=>{
  if(chatId===null||!selected.size||!ticket||deleting)return;
  el('DeleteQuestion').textContent='Ẩn '+selected.size+' tin khỏi CUNCUN? Tin gốc trên Telegram vẫn giữ nguyên.';
  el('DeleteConfirm').hidden=false;el('Keep').focus();
 };
 el('Keep').onclick=()=>{el('DeleteConfirm').hidden=true;el('Delete').focus();};
 el('ConfirmDelete').onclick=async()=>{
  if(chatId===null||!selected.size||!ticket||deleting)return;
  const ids=[...selected],target=chatId,proof=ticket;deleting=true;epoch++;el('DeleteConfirm').hidden=true;updateDeleteTools();el('ConfirmDelete').disabled=true;
  try{
   await api('hide',{chat_id:target,message_ids:ids});
   if(ticket!==proof)return;
   epoch++;if(chatId===target){const hidden=new Set(ids);messages=messages.filter(m=>!hidden.has(m.message_id));jobs=jobs.filter(j=>j.chat_id!==target||!hidden.has(j.message_id));selecting=false;selected.clear();draw();}
   status('Đã ẩn '+ids.length+' tin khỏi CUNCUN. Telegram gốc không thay đổi.');
  }catch(e){if(ticket===proof)fail(e);}
  finally{deleting=false;el('ConfirmDelete').disabled=false;updateDeleteTools();}
 };
 el('Lock').onclick=()=>{lock();gate();};el('Refresh').onclick=load;
 el('Search').oninput=()=>draw();
 for(const b of el('Tabs').querySelectorAll('button'))b.onclick=()=>{el('Mode').value=b.dataset.mode;el('Mode').onchange();};
 el('Back').onclick=()=>{if(chatId!==null)drafts.set(chatId,el('Text').value);chatId=null;epoch++;messages=[];selected.clear();selecting=false;updateDeleteTools();el('Text').value='';draw();load();};
 el('Mode').onchange=()=>{if(deleting)return;el('DeleteConfirm').hidden=true;if(chatId!==null)drafts.set(chatId,el('Text').value);chatId=null;epoch++;messages=[];selected.clear();selecting=false;updateDeleteTools();el('Text').value='';draw();load();};
 panel.addEventListener('toggle',()=>{if(panel.open){if(ticket)load();else gate();}else lock();});
 sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(userId&&session?.user.id!==userId)){lock(false);userId='';}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
 window.addEventListener('pagehide',()=>lock());setInterval(()=>{if(ticket&&Date.now()>=expires)lock();else load();},1000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
