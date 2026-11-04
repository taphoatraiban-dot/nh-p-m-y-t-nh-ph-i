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
   const read=()=>{try{const a=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(a)?a:[];}catch{return [];}};
   const write=rows=>storage.setItem(KEY,JSON.stringify(rows.slice(-1000)));
   // A restore must never append a receipt which was deleted during its cloud fetch.
   const localDeletionLedger=helper.createDeletionLedger({storage,getUserId});
   const client=integration.create({
     supabase,getUserId,storage,onStatus,
     readLocal:async()=>read().map(toCloud).filter(Boolean),
     writeLocal:async rows=>{
       // Revalidate the account after the asynchronous deletion-ledger lookup.
       const ownerBefore=await getUserId();
       if(!ownerBefore)throw new Error('Authenticated user required before restore write');
       const deleted=new Set(await localDeletionLedger.deletedIds());
       if(await getUserId()!==ownerBefore)throw new Error('Account changed before restore write');
       // Re-read just before writing so receipts saved during the cloud fetch survive.
       const existing=read(),ids=new Set(existing.map(x=>x.id));
       // A deletion can arrive while the restore is awaiting the first ledger read.
       // Recheck immediately before the synchronous localStorage write.
       const latestDeleted=new Set(await localDeletionLedger.deletedIds());
       if(await getUserId()!==ownerBefore)throw new Error('Account changed before final restore write');
       const fresh=rows.filter(x=>!ids.has(x.id)&&!deleted.has(x.id)&&!latestDeleted.has(x.id)).map(toLocal);
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
