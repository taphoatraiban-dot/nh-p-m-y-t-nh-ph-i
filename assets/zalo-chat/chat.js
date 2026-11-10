/* Manual Zalo inbox. No Zalo connection, credentials, or changes to Telegram storage. */
(function(){
'use strict';
function init(){
 const anchor=document.getElementById('ottChat')||document.getElementById('tgMemberInbox');
 if(!anchor||document.getElementById('zaloChat'))return;
 const panel=document.createElement('details');panel.id='zaloChat';
 panel.innerHTML=`<summary>💬 Zalo Chat</summary><p>CUNCUN • Tin nhắn nhập thủ công • Lịch sử 48 giờ trên thiết bị này</p>
 <p id="zaloStatus" role="status"></p><div id="zaloContent" hidden>
 <div id="zaloSearchWrap"><input id="zaloSearch" type="search" placeholder="Tìm hội thoại hoặc nội dung tin…" aria-label="Tìm hội thoại hoặc nội dung"><select id="zaloMode" aria-label="Loại hội thoại"><option value="all">Tất cả</option><option value="private">Cá nhân</option><option value="group">Nhóm</option></select></div>
 <form id="zaloNew"><input id="zaloName" maxlength="120" placeholder="Tên hội thoại Zalo" aria-label="Tên hội thoại" required><select id="zaloKind" aria-label="Loại hội thoại mới"><option value="private">Cá nhân</option><option value="group">Nhóm</option></select><button>Tạo hội thoại</button></form>
 <div id="zaloBody"><nav id="zaloConversations" aria-label="Hội thoại Zalo"></nav><section id="zaloThread" hidden>
 <button id="zaloBack" type="button">← Trở lại</button><strong id="zaloHeading"></strong>
 <label>Khách / bảng giá hiện có <select id="zaloCustomer"></select></label>
 <div class="zalo-tools"><button id="zaloAll" type="button">Chọn tất cả</button><button id="zaloCopy" type="button">Sao chép</button><button id="zaloImport" type="button">Đưa vào nhập phơi</button><button id="zaloDelete" type="button">Xóa</button><span id="zaloCount"></span></div>
 <div id="zaloConfirm" hidden role="group" aria-label="Xác nhận xóa"><p>Xóa các tin đã chọn khỏi lịch sử CUNCUN?</p><button id="zaloConfirmDelete" type="button">Xác nhận xóa</button><button id="zaloKeep" type="button">Giữ lại</button></div>
 <div id="zaloMessages" aria-label="Tin nhắn Zalo"></div>
 <form id="zaloPaste"><textarea id="zaloText" maxlength="50000" placeholder="Sao chép tin từ Zalo rồi dán vào đây…" aria-label="Dán tin Zalo" required></textarea><button>Lưu tin đã dán</button></form>
 </section></div></div>`;
 anchor.after(panel);
 const el=id=>panel.querySelector('#zalo'+id),status=t=>el('Status').textContent=t;
 let uid='',rows=[],active=null,selected=new Set(),generation=0;const TTL=48*60*60*1000;
 const key=()=> 'cuncun_zalo_phase1:'+uid;
 const id=()=>crypto.randomUUID();
 function clear(){uid='';rows=[];active=null;selected.clear();el('Text').value='';el('Name').value='';el('Customer').replaceChildren();el('Messages').replaceChildren();el('Conversations').replaceChildren();el('Content').hidden=true;el('Confirm').hidden=true;status('Đăng nhập CUNCUN để mở Zalo Chat.');}
 function prune(){const now=Date.now();rows=rows.filter(r=>r.created>now-TTL&&r.created<=now).map(r=>({...r,messages:r.messages.filter(m=>m.at>now-TTL&&m.at<=now)}));if(!rows.some(r=>r.id===active))active=null;const live=new Set(current()?.messages.map(m=>m.id)||[]);selected=new Set([...selected].filter(x=>live.has(x)));}
 function save(next){try{localStorage.setItem(key(),JSON.stringify(next));rows=next;return true;}catch{status('Không lưu được lịch sử trên thiết bị. Nội dung chưa được thay đổi; hãy sao chép bản nháp.');return false;}}
 function current(){return rows.find(r=>r.id===active);}
 function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;}
 function customers(){const source=document.getElementById('customerSelect');el('Customer').replaceChildren(new Option('Chọn khách / bảng giá',''));for(const o of source?.options||[])el('Customer').add(new Option(o.textContent,o.value));el('Customer').value=current()?.customer||'';}
 function draw(){
  prune();el('Confirm').hidden=true;el('Conversations').replaceChildren();el('Messages').replaceChildren();
  const query=el('Search').value.trim().toLocaleLowerCase('vi'),mode=el('Mode').value;
  for(const r of rows.filter(r=>(mode==='all'||r.kind===mode)&&[r.name,r.customer,...r.messages.map(m=>m.text)].join('\n').toLocaleLowerCase('vi').includes(query))){const b=button((r.kind==='group'?'👥 ':'👤 ')+r.name+' · '+r.messages.length,()=>{active=r.id;selected.clear();el('Text').value='';draw();});b.setAttribute('aria-pressed',String(active===r.id));el('Conversations').append(b);}
  const r=current();el('Thread').hidden=!r;panel.classList.toggle('zalo-thread-open',!!r);if(!r)return;
  el('Heading').textContent=r.name;customers();let day='';
  for(const m of r.messages){const date=new Date(m.at).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});if(date!==day){const h=document.createElement('h4');h.textContent=date;el('Messages').append(h);day=date;}
   const article=document.createElement('article'),label=document.createElement('label'),check=document.createElement('input'),p=document.createElement('p'),time=document.createElement('small');check.type='checkbox';check.checked=selected.has(m.id);check.setAttribute('aria-label','Chọn tin nhắn');check.onchange=()=>{check.checked?selected.add(m.id):selected.delete(m.id);tools();};label.append(check,document.createTextNode('Chọn tin'));p.textContent=m.text;time.textContent=new Date(m.at).toLocaleTimeString('vi-VN');article.append(label,time,p);el('Messages').append(article);
  }tools();
 }
 function tools(){el('Count').textContent=selected.size+' tin đã chọn';for(const n of ['Copy','Import','Delete'])el(n).disabled=!selected.size;el('All').disabled=!current()?.messages.length;}
 function chosen(){prune();return current()?.messages.filter(m=>selected.has(m.id))||[];}
 async function authenticate(){const version=++generation;try{const client=typeof sb!=='undefined'?sb:window.sb;const {data:{session}}=await client.auth.getSession();if(version!==generation)return false;if(!session){clear();return false;}if(uid!==session.user.id){clear();uid=session.user.id;try{const data=JSON.parse(localStorage.getItem(key())||'[]');rows=Array.isArray(data)?data.filter(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&['private','group'].includes(r.kind)&&Number.isFinite(r.created)&&Array.isArray(r.messages)).map(r=>({...r,messages:r.messages.filter(m=>m&&typeof m.id==='string'&&typeof m.text==='string'&&Number.isFinite(m.at))})):[];}catch{status('Không đọc được lịch sử Zalo trên thiết bị.');return false;}}
 prune();el('Content').hidden=false;return true;}catch{clear();return false;}}
 const guarded=fn=>async e=>{e?.preventDefault();if(await authenticate())fn();};
 el('New').onsubmit=guarded(()=>{const name=el('Name').value.trim();if(!name)return;const r={id:id(),name,kind:el('Kind').value,customer:'',created:Date.now(),messages:[]};if(save([...rows,r])){active=r.id;selected.clear();el('Name').value='';draw();}});
 el('Paste').onsubmit=guarded(()=>{const r=current(),text=el('Text').value.trim();if(!r||!text)return;const now=Date.now();if(save(rows.map(x=>x.id===r.id?{...x,created:now,messages:[...x.messages,{id:id(),text,at:now}]}:x))){el('Text').value='';draw();status('Đã lưu tin dán thủ công.');}});
 el('Customer').onchange=guarded(()=>{const r=current();if(r)save(rows.map(x=>x.id===r.id?{...x,customer:el('Customer').value}:x));});
 el('All').onclick=guarded(()=>{const msgs=current()?.messages||[];selected=selected.size===msgs.length?new Set():new Set(msgs.map(m=>m.id));draw();});
 el('Copy').onclick=guarded(async()=>{const text=chosen().map(m=>m.text).join('\n');if(!text)return;try{await navigator.clipboard.writeText(text);status('Đã sao chép tin đã chọn.');}catch{status('Không thể sao chép. Hãy chọn và sao chép trực tiếp nội dung tin.');}});
 el('Delete').onclick=guarded(()=>{if(chosen().length)el('Confirm').hidden=false;});el('Keep').onclick=()=>el('Confirm').hidden=true;
 el('ConfirmDelete').onclick=guarded(()=>{const r=current();if(r&&save(rows.map(x=>x.id===r.id?{...x,messages:x.messages.filter(m=>!selected.has(m.id))}:x))){selected.clear();draw();status('Đã xóa tin khỏi CUNCUN.');}});
 el('Import').onclick=guarded(()=>{const r=current(),msgs=chosen(),box=document.getElementById('bets'),source=document.getElementById('customerSelect');if(!r||!msgs.length||!box)return;
  if(!r.customer||![...source?.options||[]].some(o=>o.value===r.customer)){status('Chọn khách có bảng giá hiện còn lưu trước khi nhập phơi.');return;}
  if(box.value.trim()&&source.value!==r.customer){status('Ô nhập đang có phơi của khách khác. Hãy xử lý phơi đó trước khi chuyển khách.');return;}
  source.value=r.customer;source.dispatchEvent(new Event('change',{bubbles:true}));box.value=(box.value.trim()?box.value.replace(/\s*$/,'')+'\n':'')+msgs.map(m=>m.text).join('\n');box.dispatchEvent(new CustomEvent('input',{bubbles:true,detail:{ottChatManualImport:true,zaloManualImport:true}}));box.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('drawerClose')?.click();box.focus();box.scrollIntoView?.({behavior:'smooth',block:'center'});status('Đã đưa vào nhập phơi với bảng giá '+r.customer+'. Kiểm tra trước khi tính tiền.');});
 el('Back').onclick=()=>{active=null;selected.clear();el('Text').value='';draw();};el('Search').oninput=draw;el('Mode').onchange=draw;
 panel.addEventListener('toggle',async()=>{if(panel.open&&await authenticate()){draw();status('Dán tin từ Zalo; không tự đồng bộ hoặc gửi tin Zalo.');}});
 const launch=button('💬 Zalo Chat',async()=>{if(!document.body.classList.contains('app-unlocked')||!await authenticate())return;const drawer=document.getElementById('appDrawer');drawer?.classList.add('open');drawer?.setAttribute('aria-hidden','false');document.getElementById('drawerBackdrop')?.classList.add('open');for(let p=panel.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;panel.open=true;draw();panel.scrollIntoView?.({block:'center'});});launch.id='zaloChatOpen';document.getElementById('ottChatOpen')?.after(launch);
 try{const client=typeof sb!=='undefined'?sb:window.sb;client?.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(uid&&session?.user?.id!==uid)){generation++;clear();}});}catch{}
 window.addEventListener('storage',e=>{if(uid&&e.key===key()){uid='';authenticate().then(ok=>{if(ok)draw();});}});
 setInterval(()=>{if(uid){prune();save(rows);if(panel.open)draw();}},60000);clear();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
