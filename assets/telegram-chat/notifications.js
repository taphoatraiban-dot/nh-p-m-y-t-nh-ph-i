(function(){
'use strict';
function init(){
 const panel=document.getElementById('ottChat');if(!panel||document.getElementById('ottPushToggle'))return;
 const row=document.createElement('div');row.className='ott-chat-row';
 const button=document.createElement('button');button.id='ottPushToggle';button.type='button';button.textContent='Bật báo tin khi đóng PM';
 const note=document.createElement('small');note.id='ottPushStatus';note.setAttribute('role','status');
 row.append(button,note);panel.querySelector('summary').after(row);
 let enabled=false,busy=false,registration=null,owner='';
 const needsInstall=()=> (/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1))&&!(window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true);
 const supported=()=>isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 const say=t=>note.textContent=t;
 function draw(){button.textContent=enabled?'Tắt báo tin khi đóng PM':'Bật báo tin khi đóng PM';button.setAttribute('aria-pressed',String(enabled));}
 function foreground(){return !document.hidden&&panel.open&&document.getElementById('ottChatUnlocked')?.hidden===false;}
 async function workerPrefs(on){
  if(!registration?.active)return;
  await new Promise((resolve,reject)=>{const channel=new MessageChannel(),timeout=setTimeout(()=>reject(Error('Không cập nhật được thông báo trên thiết bị')),4000);channel.port1.onmessage=()=>{clearTimeout(timeout);channel.port1.close();resolve();};registration.active.postMessage({type:'OTT_NOTIFICATION_PREFS',enabled:on,foreground:on&&foreground()},[channel.port2]);});
 }
 async function api(action,body={}){
  const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Đăng nhập phần mềm trước khi bật thông báo.');
  owner=session.user.id;
  const res=await fetch(SUPABASE_URL+'/functions/v1/telegram-push?action='+action,{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await res.json();if(!res.ok||!data.success)throw Object.assign(Error(data.error||'Không thể cập nhật thông báo'),{code:data.code});return data;
 }
 async function worker(){
  if(registration)return registration;
  const existing=await navigator.serviceWorker.getRegistration('/');
  if(existing?.active&&!new URL(existing.active.scriptURL).pathname.endsWith('/ott-notifications-sw.js'))throw Error('Thiết bị đang dùng bộ thông báo khác; cần kiểm tra trước khi bật.');
  await navigator.serviceWorker.register('/ott-notifications-sw.js',{scope:'/'});registration=await navigator.serviceWorker.ready;return registration;
 }
 function keyBytes(key){const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
 async function sync(){
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
 button.onclick=async()=>{
  if(busy)return;
  if(needsInstall()||!supported()){await sync();return;}
  if(!enabled&&Notification.permission==='denied'){say('Thông báo đã bị chặn. Mở cài đặt thông báo của thiết bị/trình duyệt để cho phép cuncun.icu.');return;}
  // Request permission directly in the tap handler, before asynchronous network work.
  const permission=!enabled&&Notification.permission!=='granted'?Notification.requestPermission():Promise.resolve(Notification.permission);
  busy=true;button.disabled=true;
  try{
   if(enabled){
    await worker();const sub=await registration.pushManager.getSubscription();
    await workerPrefs(false);enabled=false;if(sub){try{await api('disable',{endpoint:sub.endpoint});}finally{await sub.unsubscribe();}}
    enabled=false;try{localStorage.removeItem('ott_push_owner');}catch{}say('Đã tắt thông báo nền trên thiết bị này.');
   }else{
    if(await permission!=='granted')throw Error('Chưa được cho phép thông báo. Có thể bật lại khi cần.');
    await worker();
    const key=await fetch(SUPABASE_URL+'/functions/v1/telegram-push?action=public-key',{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_PUBLISHABLE_KEY},body:'{}'}).then(r=>r.json());
    if(!key.success)throw Error(key.error||'Thông báo nền chưa sẵn sàng');
    let sub=await registration.pushManager.getSubscription();
    if(sub)await sub.unsubscribe();
    sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(key.public_key)});
    let result;
    try{result=await api('register',sub.toJSON());}catch(e){
     if(e.code!=='OTHER_ACCOUNT')throw e;
     await workerPrefs(false);await sub.unsubscribe();sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(key.public_key)});result=await api('register',sub.toJSON());
    }
    enabled=result.enabled;await workerPrefs(enabled);try{localStorage.setItem('ott_push_owner',owner);}catch{}
    say('Đã bật. Có thể rời hoặc đóng phần mềm; bấm Tắt khi không cần. Chuông theo cài đặt thiết bị.');
   }
  }catch(e){say(e.message);}finally{busy=false;button.disabled=false;draw();}
 };
 navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='OTT_OPEN_CHAT'){panel.open=true;panel.scrollIntoView({behavior:'smooth',block:'center'});}});
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
