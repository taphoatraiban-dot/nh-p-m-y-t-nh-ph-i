/* Telegram Chat experiment: independent from the existing inbox and money/print code. */
(function(){
'use strict';
function init(){
 const anchor=document.getElementById('tgMemberInbox')||document.getElementById('tgForwardInbox');
 if(!anchor||document.getElementById('ottChat'))return;
 const panel=document.createElement('details');panel.id='ottChat';
 panel.innerHTML='<summary>💬 Telegram Chat</summary><p id="ottChatStatus" role="status">Mở khóa để xem hội thoại.</p><form id="ottChatGate"><div class="ott-chat-row"><input id="ottChatPin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" aria-label="PIN Chat 4 số" placeholder="PIN Chat 4 số" required><input id="ottChatConfirm" type="password" inputmode="numeric" maxlength="4" autocomplete="off" aria-label="Xác nhận PIN Chat" placeholder="Nhập lại PIN mới" hidden><button id="ottChatUnlock" type="submit">Mở Chat</button></div></form><div id="ottChatUnlocked" hidden><div class="ott-chat-row"><select id="ottChatMode" aria-label="Loại hội thoại"><option value="all">Tất cả hội thoại</option><option value="group">Nhóm</option><option value="private">Cá nhân</option></select><button id="ottChatSound" type="button">Bật âm báo</button><button id="ottChatRefresh" type="button">Làm mới</button><button id="ottChatLock" type="button">Khóa Chat</button></div><div id="ottChatSearchWrap"><input id="ottChatSearch" type="search" placeholder="Tìm người hoặc nhóm…" aria-label="Tìm hội thoại"><div id="ottChatTabs" class="ott-chat-row"><button type="button" data-mode="private">Cá nhân</button><button type="button" data-mode="group">Nhóm</button><button type="button" data-mode="all">Tất cả</button></div></div><div id="ottChatBody"><nav id="ottChatConversations" aria-label="Danh sách hội thoại"></nav><div id="ottChatThread"><div class="ott-chat-row"><button id="ottChatBack" type="button">← Trở lại</button><strong id="ottChatHeading">Chọn hội thoại</strong></div><div class="ott-chat-row" id="ottChatDeleteTools"><button type="button" id="ottChatSelect">Chọn tin để xóa</button><button type="button" id="ottChatDelete" hidden>Xóa tin đã chọn (0)</button><button type="button" id="ottChatCancel" hidden>Hủy chọn</button></div><div id="ottChatDeleteConfirm" role="dialog" aria-modal="true" aria-label="Xác nhận ẩn tin" hidden><p id="ottChatDeleteQuestion"></p><div class="ott-chat-row"><button type="button" id="ottChatConfirmDelete">Xóa khỏi CUNCUN</button><button type="button" id="ottChatKeep">Giữ lại</button></div></div><div id="ottChatMessages" aria-label="Tin nhắn"></div><form id="ottChatCompose"><textarea id="ottChatText" maxlength="4096" aria-label="Nội dung tin nhắn" placeholder="Nhập tin nhắn Telegram…" required></textarea><div class="ott-chat-row"><button id="ottChatSend" type="submit">Gửi Telegram</button><small>Đưa tin vào nhập phơi để kiểm tra thủ công.</small></div></form></div></div></div>';
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
 let searchText='';
 let selecting=false,deleting=false;const selected=new Set();
 const pending=new Map();
 const drafts=new Map();
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
  el('DeleteConfirm').hidden=true;epoch++;ticket='';expires=0;chatId=null;groups=[];messages=[];jobs=[];seen.clear();baseline=false;drafts.clear();pending.clear();selected.clear();selecting=false;updateDeleteTools();
  view();el('Text').value='';el('Pin').value='';el('Confirm').value='';el('Messages').replaceChildren();el('Conversations').replaceChildren();
  el('Unlocked').hidden=true;el('Gate').hidden=false;status('Chat đã khóa. Nhập PIN để mở lại.');
 }
 function fail(e){if([401,403,423].includes(e.status))lock(false);status(e.message||'Không thể kết nối Chat');}
 function restoreSound(uid){try{sound=localStorage.getItem('ott_chat_sound:'+uid)!=='off';}catch{}el('Sound').textContent=sound?'Tắt âm báo':'Bật âm báo';el('Sound').setAttribute('aria-pressed',String(sound));}
 function resumeSound(){if(!sound)return;try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}}
 document.addEventListener('pointerdown',resumeSound);document.addEventListener('keydown',resumeSound);
 function beep(){if(!sound||!audio)return;try{const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=880;g.gain.setValueAtTime(.32,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);o.start();o.stop(audio.currentTime+.18);}catch{}}
 function modeGroups(){return groups.filter(g=>(el('Mode').value==='all'||(String(g.group_name).startsWith('Cá nhân: ')?'private':'group')===el('Mode').value)&&String(g.group_name).toLocaleLowerCase('vi').includes(searchText));}
 function view(){panel.classList.toggle('ott-chat-thread-open',chatId!==null);el('SearchWrap').hidden=chatId!==null;el('Back').hidden=chatId===null;for(const b of el('Tabs').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.mode===el('Mode').value));}
 function updateDeleteTools(){
  el('Select').disabled=chatId===null||deleting;el('Select').hidden=selecting;el('Delete').hidden=!selecting;el('Cancel').hidden=!selecting;
  el('Delete').textContent='Xóa tin đã chọn ('+selected.size+')';el('Delete').disabled=deleting||!selected.size;el('Cancel').disabled=deleting;
 }
 function draw(){
  updateDeleteTools();const list=el('Conversations');list.replaceChildren();
  for(const g of modeGroups()){
   const b=document.createElement('button');b.type='button';b.textContent=g.group_name;b.setAttribute('aria-pressed',String(g.chat_id===chatId));
   b.onclick=()=>{if(deleting)return;if(chatId!==null)drafts.set(chatId,el('Text').value);el('DeleteConfirm').hidden=true;chatId=g.chat_id;epoch++;messages=[];selected.clear();selecting=false;updateDeleteTools();el('Text').value=drafts.get(chatId)||'';draw();load();};list.append(b);
  }
  if(!list.children.length)list.textContent='Chưa có hội thoại được đồng bộ.';
  el('Heading').textContent=groups.find(g=>g.chat_id===chatId)?.group_name||'Chọn hội thoại';
  el('Send').disabled=sending||chatId===null;view();
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
   const b=document.createElement('button');b.type='button';b.textContent='Đưa vào nhập phơi thủ công';b.onclick=()=>{
    const box=document.getElementById('bets');if(!box){status('Không tìm thấy ô nhập phơi');return;}
    box.value=(box.value.trim()?box.value.replace(/\s*$/,'')+'\n':'')+m.text;
    box.dispatchEvent(new CustomEvent('input',{bubbles:true,detail:{ottChatManualImport:true}}));box.focus();box.scrollIntoView({behavior:'smooth',block:'center'});status('Đã đưa tin vào ô nhập phơi. Kiểm tra trước khi tính tiền.');
   };
   if(selecting&&Number.isSafeInteger(m.message_id)&&messages.some(x=>x.message_id===m.message_id)){
    const label=document.createElement('label');label.className='ott-chat-select';
    const check=document.createElement('input');check.type='checkbox';check.checked=selected.has(m.message_id);
    check.setAttribute('aria-label','Chọn tin nhắn để xóa');
    check.onchange=()=>{if(check.checked)selected.add(m.message_id);else selected.delete(m.message_id);updateDeleteTools();};
    check.disabled=deleting;label.append(check,document.createTextNode(' Chọn tin'));item.dataset.messageId=String(m.message_id);item.prepend(label);
   }
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
   const signals=fresh.notices||[];
   if(baseline&&signals.some(m=>!seen.has(m.chat_id+':'+m.message_id)&&m.sender_name!=='Đã gửi'&&!jobs.some(j=>j.state==='sent'&&j.chat_id===m.chat_id&&j.message_id===m.message_id)))beep();
   for(const m of signals)seen.add(m.chat_id+':'+m.message_id);baseline=true;
   if(seen.size>5000)seen=new Set(signals.map(m=>m.chat_id+':'+m.message_id));
   draw();status('Đã cập nhật · Tự làm mới mỗi 3 giây · Khóa sau 10 phút.');
  }catch(e){if(version===epoch)fail(e);}finally{busy=false;}
 }
 async function gate(){const version=epoch;try{const x=await api('status');if(version!==epoch)return;hasPin=x.has_pin;el('Confirm').hidden=hasPin;el('Unlock').textContent=hasPin?'Mở Chat':'Tạo PIN & mở Chat';status(hasPin?'Nhập PIN Chat 4 số.':'Tạo PIN Chat 4 số và nhập lại để xác nhận.');}catch(e){fail(e);}}
 el('Gate').onsubmit=async e=>{e.preventDefault();if(el('Unlock').disabled)return;const pin=el('Pin').value;if(!/^\d{4}$/.test(pin)){status('PIN phải đúng 4 số');return;}if(!hasPin&&pin!==el('Confirm').value){status('Hai lần nhập PIN không khớp');return;}
  el('Unlock').disabled=true;const version=epoch;
  try{const x=await api('unlock',{pin,create:!hasPin});if(version!==epoch)return;ticket=x.ticket;expires=Date.now()+x.expires_in*1000;el('Pin').value='';el('Confirm').value='';el('Gate').hidden=true;el('Unlocked').hidden=false;await load();}catch(err){fail(err);}finally{el('Unlock').disabled=false;}
 };
 el('Compose').onsubmit=async e=>{e.preventDefault();if(sending||chatId===null||!ticket)return;const text=el('Text').value;if(!text.trim())return;
  // Keep UUID after a lost response so pressing Send retries the same job.
  if(!pending.has(chatId)||pending.get(chatId).text!==text)pending.set(chatId,{id:crypto.randomUUID(),chat_id:chatId,text});
  const job=pending.get(chatId),version=epoch,proof=ticket;sending=true;el('Send').disabled=true;
  try{const x=await api('send',job);if(ticket!==proof)return;if(chatId===job.chat_id&&el('Text').value===text)el('Text').value='';if(drafts.get(job.chat_id)===text)drafts.delete(job.chat_id);pending.delete(job.chat_id);if(version!==epoch)return;status(x.job.state==='sent'?'Đã gửi':'Đã xếp hàng gửi. Chờ xác nhận từ Telegram.');await load();}catch(err){if(version===epoch)fail(err);}finally{sending=false;el('Send').disabled=chatId===null;}
 };
 el('Sound').onclick=async()=>{try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();sound=!sound;try{localStorage.setItem('ott_chat_sound:'+userId,sound?'on':'off');}catch{}el('Sound').textContent=sound?'Tắt âm báo':'Bật âm báo';el('Sound').setAttribute('aria-pressed',String(sound));if(sound)beep();}catch{status('Trình duyệt chưa cho phép âm thanh. Hãy thử lại.');}};
 el('Select').onclick=()=>{if(chatId===null){status('Hãy chọn hội thoại trước');return;}selecting=true;selected.clear();updateDeleteTools();draw();};
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
 el('Search').oninput=()=>{searchText=el('Search').value.toLocaleLowerCase('vi').trim();draw();};
 for(const b of el('Tabs').querySelectorAll('button'))b.onclick=()=>{el('Mode').value=b.dataset.mode;el('Mode').onchange();};
 el('Back').onclick=()=>{if(chatId!==null)drafts.set(chatId,el('Text').value);chatId=null;epoch++;messages=[];selected.clear();selecting=false;updateDeleteTools();el('Text').value='';draw();load();};
 el('Mode').onchange=()=>{if(deleting)return;el('DeleteConfirm').hidden=true;if(chatId!==null)drafts.set(chatId,el('Text').value);chatId=null;epoch++;messages=[];selected.clear();selecting=false;updateDeleteTools();el('Text').value='';draw();load();};
 panel.addEventListener('toggle',()=>{if(panel.open){if(ticket)load();else gate();}else lock();});
 sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(userId&&session?.user.id!==userId)){lock(false);userId='';}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
 window.addEventListener('pagehide',()=>lock());setInterval(()=>{if(ticket&&Date.now()>=expires)lock();else load();},3000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
