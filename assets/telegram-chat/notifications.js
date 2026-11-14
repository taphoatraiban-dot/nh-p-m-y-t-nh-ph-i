(function(){
'use strict';
function init(){
 const panel=document.getElementById('ottChat');if(!panel||document.getElementById('ottPushToggle'))return;
 const row=document.createElement('div');row.className='ott-chat-row';
 let button=document.createElement('button');button.id='ottPushToggle';button.type='button';button.textContent='Bật báo tin khi đóng PM';
 let note=document.createElement('div');note.id='ottPushStatus';note.setAttribute('role','status');
 button.style.cssText='touch-action:manipulation;pointer-events:auto;position:relative;z-index:2;min-height:44px';note.style.cssText='flex-basis:100%;font-size:13px;line-height:1.5;white-space:pre-line';row.append(button,note);panel.querySelector('summary').after(row);
 let enabled=false,busy=false,registration=null,owner='';
 const needsInstall=()=> (/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))&&!(window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true);
 const supported=()=>isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&typeof Notification.requestPermission==='function';
 const say=t=>{note=document.getElementById('ottPushStatus')||note;note.textContent=t;};
 function help(title,text){
  document.getElementById('ottPushHelp')?.remove();
  const shade=document.createElement('div');shade.id='ottPushHelp';shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');shade.setAttribute('aria-label',title);shade.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#0008;display:flex;align-items:center;justify-content:center;padding:18px';
  const card=document.createElement('div');card.style.cssText='background:white;color:#17212f;border-radius:14px;padding:20px;width:min(100%,400px);font:16px/1.6 system-ui;box-shadow:0 12px 40px #0005';
  const heading=document.createElement('strong');heading.textContent=title;const message=document.createElement('p');message.textContent=text;message.style.whiteSpace='pre-line';
  const close=document.createElement('button');close.type='button';close.textContent='Đã hiểu';close.style.cssText='width:100%;min-height:44px;padding:10px;background:#b91c1c;color:white;border:0;border-radius:8px;font-size:16px';close.onclick=()=>shade.remove();card.append(heading,message,close);shade.append(card);document.body.append(shade);close.focus();
 }
 function deadline(promise,message,ms=15000){let timer;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(message)),ms))]).finally(()=>clearTimeout(timer));}

 function draw(){button=document.getElementById('ottPushToggle')||button;button.textContent=enabled?'Tắt báo tin khi đóng PM':'Bật báo tin khi đóng PM';button.setAttribute('aria-pressed',String(enabled));}
 function foreground(){return !document.hidden&&panel.open&&document.getElementById('ottChatUnlocked')?.hidden===false;}
 async function workerPrefs(on){
  if(!registration?.active)return;
  await new Promise((resolve,reject)=>{const channel=new MessageChannel(),timeout=setTimeout(()=>reject(Error('Không cập nhật được thông báo trên thiết bị')),4000);channel.port1.onmessage=()=>{clearTimeout(timeout);channel.port1.close();resolve();};registration.active.postMessage({type:'OTT_NOTIFICATION_PREFS',enabled:on,foreground:on&&foreground()},[channel.port2]);});
 }
 async function api(action,body={}){
  if(window.cuncunCanUseTelegram?.()!==true)throw Error('Telegram chỉ dành cho PRO / ADMIN');
  const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Đăng nhập phần mềm trước khi bật thông báo.');
  owner=session.user.id;
  const res=await deadline(fetch(SUPABASE_URL+'/functions/v1/telegram-push?action='+action,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)}),'Kết nối thông báo quá lâu. Hãy thử lại.');
  const data=await res.json();if(!res.ok||!data.success)throw Object.assign(Error(data.error||'Không thể cập nhật thông báo'),{code:data.code});return data;
 }
 async function worker(){
  if(registration)return registration;
  const existing=await navigator.serviceWorker.getRegistration('/');
  if(existing?.active&&!new URL(existing.active.scriptURL).pathname.endsWith('/ott-notifications-sw.js'))throw Error('Thiết bị đang dùng bộ thông báo khác; cần kiểm tra trước khi bật.');
  await deadline(navigator.serviceWorker.register('/ott-notifications-sw.js',{scope:'/'}),'Không khởi tạo được thông báo. Hãy mở bằng Safari và thử lại.');registration=await deadline(navigator.serviceWorker.ready,'Chưa khởi tạo xong thông báo. Hãy đóng và mở lại biểu tượng ÔNG THẦN TÀI.');return registration;
 }
 function keyBytes(key){const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
 async function sync(){
  if(window.cuncunCanUseTelegram?.()!==true){enabled=false;await workerPrefs(false).catch(()=>{});draw();return;}
  if(needsInstall()){say('iPhone/iPad: mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính. Mở biểu tượng ÔNG THẦN TÀI rồi bật thông báo.');return;}
  if(!supported()){say(/iPhone|iPad|iPod/.test(navigator.userAgent)?'Trên iPhone/iPad: thêm phần mềm vào Màn hình chính, mở từ biểu tượng đó rồi bật thông báo.':'Trình duyệt này chưa hỗ trợ thông báo khi đóng phần mềm.');return;}
  try{
   const {data:{session}}=await sb.auth.getSession();if(!session)return;
   await worker();const sub=await registration.pushManager.getSubscription();
   let previous='';try{previous=localStorage.getItem('ott_push_owner')||'';}catch{}
   if(sub&&previous&&previous!==session.user.id){await workerPrefs(false);await sub.unsubscribe();enabled=false;draw();say('Bật lại thông báo cho tài khoản đang đăng nhập.');return;}
   if(!sub){enabled=false;draw();say('Bật một lần trên thiết bị này; phần mềm sẽ nhớ đến khi anh/chị tắt.');return;}
   const result=await api('status',{endpoint:sub.endpoint});enabled=result.enabled&&Notification.permission==='granted';await workerPrefs(enabled);draw();
   say(enabled?'Đang bật trên thiết bị này, kể cả khi rời phần mềm.':'Thông báo nền đang tắt trên thiết bị này.');
  }catch(e){say(e.message);}
 }
 async function toggle(){
  if(window.cuncunCanUseTelegram?.()!==true){say('Telegram chỉ dành cho PRO / ADMIN');return;}
  if(busy)return;
  if(needsInstall()){
   const message='1. Mở cuncun.icu bằng Safari.\n2. Bấm Chia sẻ → Thêm vào Màn hình chính.\n3. Mở từ biểu tượng ÔNG THẦN TÀI vừa thêm.\n4. Đăng nhập, bấm Bật báo tin rồi chọn Cho phép.';
   say('Cần mở từ biểu tượng trên Màn hình chính để bật thông báo iPhone.');help('Bật thông báo trên iPhone/iPad',message);return;
  }
  if(!supported()){say('Trình duyệt hiện tại chưa hỗ trợ báo nền.');help('Chưa hỗ trợ thông báo','Trên iPhone/iPad hãy dùng Safari để thêm phần mềm vào Màn hình chính, rồi mở từ biểu tượng đó. Cần iOS/iPadOS 16.4 trở lên.');return;}
  if(!enabled&&Notification.permission==='denied'){const message='Thông báo đã bị chặn. Mở Cài đặt → Thông báo → ÔNG THẦN TÀI để cho phép. Nếu chưa thấy tên ứng dụng, thêm lại từ Safari vào Màn hình chính rồi thử lại.';say(message);help('Cần cho phép thông báo',message);return;}
  busy=true;button.disabled=true;button.textContent=enabled?'Đang tắt…':'Đang bật…';say('Đang xử lý. Nếu iPhone hỏi quyền thông báo, hãy chọn Cho phép.');
  try{
   // This call stays in the original tap, before any await, for Safari permission.
   const permission=!enabled&&Notification.permission!=='granted'?Notification.requestPermission():Promise.resolve(Notification.permission);
   if(enabled){
    await worker();const sub=await registration.pushManager.getSubscription();
    await workerPrefs(false);enabled=false;if(sub){try{await api('disable',{endpoint:sub.endpoint});}finally{await sub.unsubscribe();}}
    enabled=false;try{localStorage.removeItem('ott_push_owner');}catch{}say('Đã tắt thông báo nền trên thiết bị này.');
   }else{
    if(await deadline(permission,'Chưa nhận được quyền thông báo. Hãy thử lại và chọn Cho phép.',30000)!=='granted')throw Error('Chưa được cho phép thông báo. Có thể bật lại khi cần.');
    await worker();
    const key=await deadline(fetch(SUPABASE_URL+'/functions/v1/telegram-push?action=public-key',{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_PUBLISHABLE_KEY},body:'{}'}).then(r=>r.json()),'Không tải được cấu hình thông báo. Hãy thử lại.');
    if(!key.success)throw Error(key.error||'Thông báo nền chưa sẵn sàng');
    let sub=await registration.pushManager.getSubscription();
    if(sub)await sub.unsubscribe();
    sub=await deadline(registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(key.public_key)}),'iPhone chưa đăng ký được thông báo. Kiểm tra quyền thông báo và kết nối mạng.');
    let result;
    try{result=await api('register',sub.toJSON());}catch(e){
     if(e.code!=='OTHER_ACCOUNT')throw e;
     await workerPrefs(false);await sub.unsubscribe();sub=await deadline(registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(key.public_key)}),'iPhone chưa đăng ký được thông báo. Kiểm tra quyền thông báo và kết nối mạng.');result=await api('register',sub.toJSON());
    }
    enabled=result.enabled;await workerPrefs(enabled);try{localStorage.setItem('ott_push_owner',owner);}catch{}
    say('Đã bật. Có thể rời hoặc đóng phần mềm; bấm Tắt khi không cần. Chuông theo cài đặt thiết bị.');
   }
  }catch(e){say(e.message);help('Chưa bật được thông báo',e.message);}finally{busy=false;button=document.getElementById('ottPushToggle')||button;button.disabled=false;draw();}
 }
 document.addEventListener('click',event=>{const tapped=event.target.closest?.('#ottPushToggle');if(!tapped)return;event.preventDefault();event.stopPropagation();button=tapped;toggle();},true);
 window.addEventListener('cuncun:edition-changed',()=>{if(window.cuncunCanUseTelegram?.()!==true){enabled=false;workerPrefs(false).catch(()=>{});draw();}else sync();});
 window.addEventListener('cuncun:telegram-ready',()=>sync());
 navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='OTT_OPEN_CHAT'&&window.cuncunCanUseTelegram?.()===true){panel.open=true;panel.scrollIntoView({behavior:'smooth',block:'center'});}});
 sb.auth.onAuthStateChange((event,session)=>{if(session?.user)setTimeout(sync,0);});
 document.addEventListener('visibilitychange',()=>{if(enabled)workerPrefs(true).catch(()=>{});});
 panel.addEventListener('toggle',()=>{if(enabled)workerPrefs(true).catch(()=>{});});
 setInterval(()=>{if(enabled)workerPrefs(true).catch(()=>{});},10000);
 // Closing the page does not disable the subscription or alter the saved preference.
 window.addEventListener('pagehide',()=>{registration?.active?.postMessage({type:'OTT_NOTIFICATION_PREFS',enabled,foreground:false});});
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
