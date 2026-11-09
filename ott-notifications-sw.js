/* Notification-only worker: no caching or interception of application requests. */
const DB='ott-notification-preferences';
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,2);r.onupgradeneeded=()=>{for(const name of ['settings','seen'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);});}
async function saved(store,key,value){const db=await database();return new Promise((resolve,reject)=>{const write=value!==undefined,tx=db.transaction(store,write?'readwrite':'readonly'),s=tx.objectStore(store),r=write?s.put(value,key):s.get(key);let result;r.onsuccess=()=>result=write?value:r.result;tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};});}
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{
 if(e.data?.type!=='OTT_NOTIFICATION_PREFS')return;
 const value={enabled:e.data.enabled===true,foreground:e.data.foreground===true,foregroundAt:Date.now()};
 e.waitUntil(saved('settings','device',value).then(()=>e.ports[0]?.postMessage({ok:true})));
});
self.addEventListener('push',e=>e.waitUntil((async()=>{
 const state=await saved('settings','device');if(!state?.enabled)return;
 let data={};try{data=e.data?.json()||{};}catch{}
 const tag=typeof data.tag==='string'?data.tag.slice(0,100):'ott-telegram';
 if(await saved('seen',tag))return;
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 const foreground=state.foreground&&Date.now()-state.foregroundAt<15000&&windows.some(w=>w.visibilityState==='visible');
 await self.registration.showNotification('ÔNG THẦN TÀI',{
  body:'Có tin nhắn Telegram mới. Mở phần mềm để xem.',icon:'/assets/telegram-chat/icon-192.png',badge:'/assets/telegram-chat/icon.svg',
  tag,renotify:false,silent:!!foreground,...(foreground?{}:{vibrate:[200,100,200]}),data:{url:'/?openChat=1'}
 });
 await saved('seen',tag,Date.now());
})()));
self.addEventListener('notificationclick',e=>{
 e.notification.close();e.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(w=>new URL(w.url).origin===self.location.origin);
  if(existing){existing.postMessage({type:'OTT_OPEN_CHAT'});return existing.focus();}
  return self.clients.openWindow('/?openChat=1');
 })());
});
