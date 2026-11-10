/* CUNCUN Zalo demo launcher. Opt-in only; no Zalo network integration. */
(function(){
'use strict';
function mount(){
 if(document.getElementById('cuncunZaloDemoLauncher'))return;
 const anchor=document.getElementById('ottChat')||document.getElementById('tgMemberInbox')||document.getElementById('tgForwardInbox');
 if(!anchor)return;
 const container=document.createElement('div');
 container.id='cuncunZaloDemoLauncher';
 container.style.cssText='margin:10px 0;padding:10px;border:1px solid #cfe0f4;border-radius:12px;background:#f6faff';
 const button=document.createElement('button');
 button.type='button';button.textContent='💬 Zalo Chat · Demo';
 button.style.cssText='background:#087cf5;color:#fff;border:0;border-radius:9px;padding:11px 16px;font:inherit;cursor:pointer';
 const status=document.createElement('span');
 status.textContent=' Chưa kết nối Zalo';status.style.cssText='font-size:12px;color:#536b85;margin-left:8px';
 button.addEventListener('click',()=>{
  const old=document.getElementById('cuncunZaloDemoFrame');
  if(old){old.remove();button.setAttribute('aria-expanded','false');return}
  const frame=document.createElement('iframe');
  frame.id='cuncunZaloDemoFrame';frame.title='Zalo Chat giao diện mẫu';
  frame.src='experiments/zalo-chat/index.html';
  frame.setAttribute('sandbox','allow-scripts allow-forms');
  frame.setAttribute('referrerpolicy','no-referrer');
  frame.style.cssText='display:block;width:100%;height:min(78dvh,760px);border:1px solid #d7e5f4;border-radius:12px;margin-top:10px;background:white';
  container.append(frame);button.setAttribute('aria-expanded','true');
 });
 button.setAttribute('aria-expanded','false');
 container.append(button,status);anchor.insertAdjacentElement('afterend',container);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
