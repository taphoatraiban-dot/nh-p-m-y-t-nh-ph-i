/* CUNCUN staging-only bridge for existing TSH_PRINT_HISTORY_V1 entries.
   Load only after both recent backup helpers and authenticated Supabase client.
   Does not intercept localStorage, printing or deletion automatically. */
(function(root){
 'use strict';
 const KEY='TSH_PRINT_HISTORY_V1';
 function toCloud(row){
   if(!row||typeof row.id!=='string'||!row.id.trim()||!Number.isFinite(Number(row.createdAt))||Number(row.createdAt)<=0)return null;
   const date=new Date(Number(row.createdAt));
   if(Number.isNaN(date.getTime()))return null;
   const created_at=date.toISOString();
   return {...row,created_at};
 }
 function toLocal(row){
   const copy={...row};
   delete copy.created_at;
   return copy;
 }
 function create({supabase,getUserId,storage=root.localStorage,onStatus}){
   const helper=root.CuncunRecentPhoiBackup;
   const integration=root.CuncunRecentPhoiIntegration;
   if(!helper||!integration)throw new Error('Recent backup helpers not loaded');
   const ledger=helper.createDeletionLedger({storage,getUserId});
   const read=()=>{const a=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(a)?a:[];};
   const write=rows=>storage.setItem(KEY,JSON.stringify(rows.slice(-1000)));
   const client=integration.create({
     supabase,getUserId,storage,onStatus,
     readLocal:async()=>read().map(toCloud).filter(Boolean),
     writeLocal:async rows=>{
       // Keep existing local rows and IDs. The integration merges by stable ID.
       const existing=read(),ids=new Set(existing.map(x=>x.id));
       const fresh=rows.filter(x=>!ids.has(x.id)).map(toLocal);
       if(fresh.length)write(existing.concat(fresh));
     },
     readDeletedIds:()=>ledger.deletedIds(),
     onReceiptDeletedLocal:id=>ledger.markDeleted(id)
   });
   return {
     saved:row=>{const item=toCloud(row);return item?client.onReceiptSaved(item):Promise.resolve({queued:false});},
     deleted:id=>client.onReceiptDeleted(id),
     recover:()=>client.recover(),
     retry:()=>client.retry(),
     pending:()=>client.pending()
   };
 }
 root.CuncunRecentPhoiPrintBridge={create};
})(typeof window!=='undefined'?window:globalThis);
