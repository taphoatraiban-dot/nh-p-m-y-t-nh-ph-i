/* Staging-only print-history hooks. Does not contact cloud or modify receipts.
   Explicitly attach a configured bridge after authenticated staging is ready. */
(function(root){
 'use strict';
 let bridge=null;
 function attach(client){
   if(!client||typeof client.saved!=='function'||typeof client.deleted!=='function')
     throw new TypeError('Configured print backup bridge required');
   bridge=client;
 }
 function detach(){bridge=null;}
 function saved(receipt){
   if(!bridge)return;
   try{Promise.resolve(bridge.saved(receipt)).catch(()=>{});}catch(_){}
 }
 function deleted(receiptIds){
   if(!bridge)return;
   const ids=Array.isArray(receiptIds)?receiptIds:[receiptIds];
   for(const id of ids){
     if(typeof id!=='string'||!id.trim())continue;
     try{Promise.resolve(bridge.deleted(id)).catch(()=>{});}catch(_){}
   }
 }
 root.CuncunRecentPhoiHooks={attach,detach,saved,deleted};
})(typeof window!=='undefined'?window:globalThis);
