/* CUNCUN optional opening reminder; never changes network/VPN settings. */
(function(){
 'use strict';
 function show(){
  if(document.getElementById('cuncunVpnTicker'))return;
  const wrap=document.createElement('div');
  wrap.id='cuncunVpnTicker';
  wrap.setAttribute('role','status');
  wrap.setAttribute('aria-label','Thông báo bảo mật');
  wrap.style.cssText='position:fixed;left:10px;right:10px;top:calc(env(safe-area-inset-top, 0px) + 8px);z-index:2147483000;display:flex;align-items:center;gap:8px;min-height:38px;background:#103d35;color:#fff;border-radius:11px;box-shadow:0 5px 18px #0003;overflow:hidden;font:600 13px/1.4 system-ui,-apple-system,sans-serif';
  const track=document.createElement('div');
  track.style.cssText='flex:1;overflow:hidden;white-space:nowrap';
  const message=document.createElement('div');
  message.textContent='🔒 Hãy bật VPN 1.1.1.1 (WARP) để tăng cường bảo vệ kết nối khi sử dụng CUNCUN.';
  message.style.cssText='display:inline-block;white-space:nowrap;will-change:transform;animation:cuncunVpnScroll 11s linear infinite';
  const close=document.createElement('button');
  close.type='button';close.textContent='×';close.setAttribute('aria-label','Đóng thông báo');
  close.style.cssText='flex:none;width:36px;height:36px;border:0;background:transparent;color:white;font-size:26px;cursor:pointer';
  const style=document.createElement('style');
  style.textContent='@keyframes cuncunVpnScroll{from{transform:translateX(100vw)}to{transform:translateX(-100%)}}@media(prefers-reduced-motion:reduce){#cuncunVpnTicker div div{animation:none!important;padding-left:8px!important;white-space:normal!important}}';
  close.onclick=()=>{wrap.remove();style.remove();};
  track.appendChild(message);wrap.append(track,close);document.head.appendChild(style);document.body.appendChild(wrap);
  setTimeout(()=>{if(wrap.isConnected){wrap.remove();style.remove();}},18000);
 }
 // Show only on the explicit successful PIN unlock event.
 window.addEventListener('cuncun:pin-unlocked',()=>{
  const pin=document.getElementById('pinCard'),app=document.getElementById('appCard');
  if(pin?.classList.contains('hidden')&&!app?.classList.contains('hidden'))show();
 });
})();