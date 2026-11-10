/* CUNCUN Zalo demo launcher. Opt-in only; no account or network integration. */
(function(){
'use strict';
const ID='cuncunZaloDemoLauncher', FRAME_ID='cuncunZaloDemoFrame';
function mount(){
 if(document.getElementById(ID))return true;
 const anchor=document.getElementById('ottChat')||document.getElementById('tgMemberInbox')||document.getElementById('tgForwardInbox');
 if(!anchor)return false;
 const container=document.createElement('section');container.id=ID;
 container.setAttribute('aria-label','Zalo Chat thử nghiệm');
 container.style.cssText='margin:10px 0;padding:10px;border:1px solid #cfe0f4;border-radius:12px;background:#f6faff';
 const button=document.createElement('button');button.type='button';
 button.textContent='💬 Zalo Chat · Demo';
 button.setAttribute('aria-controls',FRAME_ID);button.setAttribute('aria-expanded','false');
 button.style.cssText='background:#087cf5;color:#fff;border:0;border-radius:9px;padding:11px 16px;font:inherit;cursor:pointer';
 const status=document.createElement('span');status.textContent=' Chưa kết nối Zalo';
 status.style.cssText='font-size:12px;color:#536b85;margin-left:8px';
 function close(){
  const frame=document.getElementById(FRAME_ID);
  if(frame)frame.remove();
  button.setAttribute('aria-expanded','false');
  button.textContent='💬 Zalo Chat · Demo';
 }
 button.addEventListener('click',()=>{
  if(document.getElementById(FRAME_ID)){close();return}
  const frame=document.createElement('iframe');frame.id=FRAME_ID;
  frame.title='Zalo Chat giao diện mẫu (không kết nối)';
  frame.src='experiments/zalo-chat/index.html';
  frame.setAttribute('sandbox','allow-scripts allow-forms');
  frame.setAttribute('referrerpolicy','no-referrer');
  frame.setAttribute('loading','lazy');
  frame.style.cssText='display:block;width:100%;height:min(78dvh,760px);border:1px solid #d7e5f4;border-radius:12px;margin-top:10px;background:white';
  container.append(frame);button.setAttribute('aria-expanded','true');button.textContent='✕ Đóng Zalo Demo';
 });
 document.addEventListener('cuncun:logout',close);
 container.append(button,status);anchor.insertAdjacentElement('afterend',container);
 return true;
}
function boot(){
 if(mount())return;
 // CUNCUN may render Telegram controls after DOMContentLoaded.
 const observer=new MutationObserver(()=>{if(mount())observer.disconnect()});
 observer.observe(document.body,{childList:true,subtree:true});
 // Stop observing once page has loaded and settled; no permanent DOM watcher.
 window.addEventListener('load',()=>{if(mount())observer.disconnect()},{once:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
