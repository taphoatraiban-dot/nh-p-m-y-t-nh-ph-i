/* Telegram belongs to PRO/ADMIN. UI checks are backed by fresh server checks. */
(function(){
 'use strict';
 const roots='#ottChatOpen,#ottChat,#tgDrawerSections20261022,#tgMemberInbox,#tgForwardInbox,#tgTenantPanel,#tgCustomerVpsSetup,#tgVpsKeyMenu,#tgAdminBots,#tgAutoGroupInbox,#tgLegacyMenu,#tgMemberQuickSetup,#tgCustomerSetup,.tg-legacy-menu';
 const allowed=()=>document.body?.dataset.edition==='pro'&&document.body.classList.contains('app-unlocked');
 window.cuncunCanUseTelegram=allowed;
 const style=document.createElement('style');style.id='cuncun-telegram-pro-gate';
 style.textContent=roots.split(',').map(s=>'body:not([data-edition="pro"]) '+s).join(',')+'{display:none!important;visibility:hidden!important}body[data-edition="pro"] #telegramProNotice{display:none!important}#telegramProNotice{padding:12px;margin:8px 0;border:1px solid #d8b4fe;border-radius:10px;color:#6b21a8;background:#faf5ff;font-weight:800}';
 document.head.append(style);
 const originalFetch=window.fetch.bind(window);
 window.fetch=function(input,options){
  try{const u=new URL(typeof input==='string'?input:input.url,location.href);
   if(/^\/functions\/v1\/telegram(?:-|\/|$)/.test(u.pathname)&&!allowed())return Promise.resolve(new Response(JSON.stringify({success:false,error:'Telegram chỉ dành cho PRO / ADMIN',code:'PRO_REQUIRED'}),{status:403,headers:{'content-type':'application/json'}}));
  }catch(_e){}
  return originalFetch(input,options);
 };
 document.addEventListener('click',e=>{if(!allowed()&&e.target.closest?.(roots)){e.preventDefault();e.stopImmediatePropagation();}},true);
 function init(){let before=allowed();new MutationObserver(()=>{const now=allowed();if(now&&!before)window.dispatchEvent(new Event('cuncun:telegram-ready'));before=now;}).observe(document.body,{attributes:true,attributeFilter:['class','data-edition']});const host=document.getElementById('appCard');if(host&&!document.getElementById('telegramProNotice')){const note=document.createElement('div');note.id='telegramProNotice';note.textContent='🔒 TELEGRAM · PRO';note.setAttribute('role','status');host.append(note);}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
