/* Zalo connection status. No account or network integration. */
(function(){
'use strict';
const ID='cuncunZaloDemoLauncher', FRAME_ID='cuncunZaloDemoFrame';
function mount(){
 if(document.getElementById(ID))return true;
 const anchor=document.getElementById('ottChat')||document.getElementById('tgMemberInbox')||document.getElementById('tgForwardInbox');
 if(!anchor)return false;
 const container=document.createElement('section');container.id=ID;
 container.setAttribute('aria-label','Zalo Chat thử nghiệm');
 container.style.cssText='margin:6px 0;padding:8px;border:1px solid #cfe0f4;border-radius:12px;background:#f6faff';
 const button=document.createElement('button');button.type='button';
 button.textContent='💬 Zalo';
 button.setAttribute('aria-controls',FRAME_ID);button.setAttribute('aria-expanded','false');
 button.style.cssText='background:#087cf5;color:#fff;border:0;border-radius:9px;padding:11px 16px;min-height:44px;font:inherit;cursor:pointer';
 const status=document.createElement('span');status.textContent=' Chưa kết nối · chưa nhận tin thật';
 status.style.cssText='font-size:12px;color:#536b85;margin-left:8px';
 function close(){
  const frame=document.getElementById(FRAME_ID);
  if(frame)frame.remove();
  button.setAttribute('aria-expanded','false');
  button.textContent='💬 Zalo';
  container.style.padding='10px';
 }
 button.addEventListener('click',()=>{
  // Never expose a chat-like preview while the CUNCUN session is locked.
  if(!document.body.classList.contains('app-unlocked')){
   status.textContent=' Mở khóa CUNCUN trước khi xem Zalo';close();return;
  }
  if(document.getElementById(FRAME_ID)){close();return}
  const frame=document.createElement('iframe');frame.id=FRAME_ID;
  frame.title='Trạng thái kết nối Zalo';
  frame.src='assets/zalo-chat/status.html';
  frame.setAttribute('sandbox','allow-scripts');
  frame.setAttribute('referrerpolicy','no-referrer');
  frame.setAttribute('loading','lazy');
  frame.style.cssText='display:block;width:100%;height:min(78dvh,760px);border:1px solid #d7e5f4;border-radius:12px;margin-top:10px;background:white';
  frame.setAttribute('allow','clipboard-write');
  if(window.matchMedia && window.matchMedia('(max-width: 650px)').matches){
   frame.style.height='max(320px, calc(100dvh - 170px))';
   frame.style.minHeight='0';
   container.style.padding='6px';
  }
  container.append(frame);button.setAttribute('aria-expanded','true');button.textContent='✕ Đóng Zalo';
 });
 const lockObserver=new MutationObserver(()=>{
  if(!document.body.classList.contains('app-unlocked'))close();
 });
 lockObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('cuncun:logout',close);
 // Hide demo conversations whenever the iPhone app goes into the background.
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')close();
 });
 window.addEventListener('pagehide',()=>{close();lockObserver.disconnect()});
 container.append(button,status);anchor.insertAdjacentElement('afterend',container);
 return true;
}
function boot(){
 if(mount())return;
 // CUNCUN may render Telegram controls after DOMContentLoaded.
 let timeoutId;
 const stop=()=>{observer.disconnect();window.clearTimeout(timeoutId)};
 const observer=new MutationObserver(()=>{if(mount())stop()});
 observer.observe(document.body,{childList:true,subtree:true});
 // Bound the observer lifetime; also release the timer if Telegram mounts early.
 timeoutId=window.setTimeout(stop,15000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
