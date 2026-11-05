/* Explicit opt-in bootstrap for the CUNCUN print-history backup.
   No production auto-start, no credentials, no database provisioning. */
(function(root){
 'use strict';
 let session=null;
 function start({supabase,getUserId,storage=root.localStorage,onStatus}={}){
   if(session)throw new Error('Recent print backup already started');
   if(!supabase||typeof supabase.from!=='function')throw new TypeError('Supabase client required');
   if(typeof getUserId!=='function')throw new TypeError('Authenticated user getter required');
   if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')
     throw new TypeError('Persistent local storage required');
   const hooks=root.CuncunRecentPhoiHooks;
   const factory=root.CuncunRecentPhoiPrintBridge;
   if(!hooks||!factory)throw new Error('Print backup dependencies not loaded');
   const bridge=factory.create({supabase,getUserId,storage,onStatus});
   hooks.attach(bridge);
   session=bridge;
   return {recover:()=>bridge.recover(),retry:()=>bridge.retry(),pending:()=>bridge.pending()};
 }
 function stop(){
   if(!session)return;
   root.CuncunRecentPhoiHooks.detach();
   session=null;
 }
 async function syncNow(){
   if(!session)throw new Error('Đồng bộ chưa kích hoạt. Hãy đăng nhập lại.');
   await session.retry();
   return session.recover();
 }
 function active(){return !!session;}
 root.CuncunRecentPhoiBootstrap={start,stop,active,syncNow};
})(typeof window!=='undefined'?window:globalThis);
