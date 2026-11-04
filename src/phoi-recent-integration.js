/* Integration adapter. Must be explicitly wired to the real receipt-save path.
   Do not automatically intercept print buttons or infer receipt IDs. */
(function(root){
 'use strict';
 function create({supabase,getUserId,storage,readLocal,writeLocal,readDeletedIds,onReceiptDeletedLocal,onStatus}){
   const helper=root.CuncunRecentPhoiBackup;
   if(!helper) throw new Error('Backup helper not loaded');
   const queue=helper.createBackupQueue({supabase,getUserId,storage});
   const status=typeof onStatus==='function'?onStatus:()=>{};
   async function onReceiptSaved(receipt){
     let userId;
     try {userId=await getUserId();}
     catch(error){status({state:'backup_unavailable',error:String(error)});return {queued:false,error:'backup_unavailable'};}
     if(!userId){status({state:'not_authenticated'});return {queued:false};}
     // Never block printing if offline backup storage cannot be written.
     try {queue.enqueue(receipt,userId);}
     catch(error){status({state:'backup_unavailable',error:String(error)});return {queued:false,error:'backup_unavailable'};}
     status({state:'pending',count:queue.pending()});
     // Never wait for the network before the caller proceeds to print.
     // enqueue() has already durably written the pending snapshot to storage.
     void queue.flush().then(result=>{
       status({state:result.error?'pending':'synced',count:result.pending});
     }).catch(error=>{
       status({state:'pending',count:queue.pending(),error:String(error)});
     });
     return {queued:true,pending:queue.pending()};
   }
   async function recover(){
     const userId=await getUserId();
     if(!userId) throw new Error('Authenticated user required');
     const remote=await helper.restore({supabase,userId});
     if(await getUserId()!==userId) throw new Error('Account changed during restore');
     const local=await readLocal();
     if(await getUserId()!==userId) throw new Error('Account changed during restore');
     const deletedIds=typeof readDeletedIds==='function'?await readDeletedIds():[];
     const merged=helper.mergeRestored(local,remote,new Date(),deletedIds);
     if(merged.length>local.length){
       // Re-read immediately before writing to preserve receipts saved while the cloud request was in flight.
       const latest=await readLocal();
       if(await getUserId()!==userId) throw new Error('Account changed before restore write');
       const latestDeletedIds=typeof readDeletedIds==='function'?await readDeletedIds():[];
       const current=helper.mergeRestored(latest,remote,new Date(),latestDeletedIds);
       if(current.length>latest.length) await writeLocal(current);
       status({state:'restored',count:current.length-latest.length});
       return {restored:current.length-latest.length,total:current.length};
     }
     status({state:'restored',count:merged.length-local.length});
     return {restored:merged.length-local.length,total:merged.length};
   }
   async function onReceiptDeleted(receiptId){
     // The real delete handler must persist its own deletion first, then call this.
     // A cloud failure never undoes a local deletion; report it for explicit retry.
     let userId;
     try {userId=await getUserId();}
     catch(error){status({state:'delete_sync_pending',error:String(error)});return {synced:false};}
     if(!userId){status({state:'delete_sync_pending',error:'not_authenticated'});return {synced:false};}
     try {
       if(typeof onReceiptDeletedLocal!=='function') throw new Error('Local deletion marker adapter required');
       await onReceiptDeletedLocal(receiptId);
     } catch(error){
       status({state:'delete_sync_pending',error:String(error)});
       return {synced:false};
     }
     try {
       await helper.markCloudDeleted({supabase,userId,receiptId});
       status({state:'delete_synced'});
       return {synced:true};
     } catch(error){
       status({state:'delete_sync_pending',error:String(error)});
       return {synced:false};
     }
   }
   return {onReceiptSaved,onReceiptDeleted,recover,retry:()=>queue.flush(),pending:()=>queue.pending()};
 }
 root.CuncunRecentPhoiIntegration={create};
})(typeof window!=='undefined'?window:globalThis);
