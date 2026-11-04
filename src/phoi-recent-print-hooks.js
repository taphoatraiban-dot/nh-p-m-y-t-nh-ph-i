/* Staging-only print-history hooks. Does not contact cloud or modify receipts.
   Explicitly attach a configured bridge after authenticated staging is ready. */
(function(root){
 'use strict';
 let bridge=null;
 let inFlight=0;
 let lastError=null;
 function run(work){
   inFlight++;
   try{
     Promise.resolve().then(work).catch(error=>{lastError=String(error);}).finally(()=>{inFlight--;});
   }catch(error){lastError=String(error);inFlight--;}
 }
 function attach(client){
   if(bridge)throw new Error('Print backup hooks already attached');
   if(!client||typeof client.saved!=='function'||typeof client.deleted!=='function')
     throw new TypeError('Configured print backup bridge required');
   bridge=client;
 }
 function detach(){bridge=null;}
 function saved(receipt){
   if(!bridge)return;
   const current=bridge;
   run(()=>current.saved(receipt));
 }
 function deleted(receiptIds){
   if(!bridge)return;
   const ids=Array.isArray(receiptIds)?receiptIds:[receiptIds];
   for(const id of ids){
     if(typeof id!=='string'||!id.trim())continue;
     const current=bridge;
     run(()=>current.deleted(id));
   }
 }
 function diagnostics(){return {attached:!!bridge,inFlight,lastError};}
 root.CuncunRecentPhoiHooks={attach,detach,saved,deleted,diagnostics};
})(typeof window!=='undefined'?window:globalThis);
