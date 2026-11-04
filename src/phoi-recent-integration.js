/* Integration adapter. Must be explicitly wired to the real receipt-save path.
   Do not automatically intercept print buttons or infer receipt IDs. */
(function(root){
 'use strict';
 function create({supabase,getUserId,storage,readLocal,writeLocal,readDeletedIds,onReceiptDeletedLocal,onStatus}){
   const helper=root.CuncunRecentPhoiBackup;
   if(!helper) throw new Error('Backup helper not loaded');
   const queue=helper.createBackupQueue({supabase,getUserId,storage});
   // Pending deletes must be synchronized before retrying old backup uploads.
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
     const deletedIds=[...(typeof readDeletedIds==='function'?await readDeletedIds():[]),...pendingDeletions().filter(x=>x.userId===userId).map(x=>x.receiptId)];
     const merged=helper.mergeRestored(local,remote,new Date(),deletedIds);
     if(merged.length>local.length){
       // Re-read immediately before writing to preserve receipts saved while the cloud request was in flight.
       const latest=await readLocal();
       if(await getUserId()!==userId) throw new Error('Account changed before restore write');
       const latestDeletedIds=[...(typeof readDeletedIds==='function'?await readDeletedIds():[]),...pendingDeletions().filter(x=>x.userId===userId).map(x=>x.receiptId)];
       const current=helper.mergeRestored(latest,remote,new Date(),latestDeletedIds);
       if(current.length>latest.length) await writeLocal(current);
       status({state:'restored',count:current.length-latest.length});
       return {restored:current.length-latest.length,total:current.length};
     }
     status({state:'restored',count:merged.length-local.length});
     return {restored:merged.length-local.length,total:merged.length};
   }
   const deletedQueueKey='cuncun_pending_phoi_deletions_v1';
   function pendingDeletions(){
     try {const rows=JSON.parse(storage.getItem(deletedQueueKey)||'[]');return Array.isArray(rows)?rows:[];}
     catch{return [];}
   }
   function queueDeletion(userId,receiptId){
     const rows=pendingDeletions().filter(x=>!(x.userId===userId&&x.receiptId===receiptId));
     rows.push({userId,receiptId});
     storage.setItem(deletedQueueKey,JSON.stringify(rows));
   }
   async function retryDeletions(){
     const userId=await getUserId();
     if(!userId)return {synced:0,pending:pendingDeletions().length};
     let synced=0;
     const completed=new Set();
     for(const item of pendingDeletions()){
       if(!item||item.userId!==userId||typeof item.receiptId!=='string')continue;
       if(await getUserId()!==userId)break;
       try {
         await helper.markCloudDeleted({supabase,userId,receiptId:item.receiptId});
         completed.add(userId+'\\u0000'+item.receiptId);
         synced++;
       } catch {}
     }
     // Keep concurrent additions and other accounts' pending deletions.
     const remaining=pendingDeletions().filter(x=>!completed.has(x.userId+'\\u0000'+x.receiptId));
     storage.setItem(deletedQueueKey,JSON.stringify(remaining));
     return {synced,pending:remaining.length};
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
       queueDeletion(userId,receiptId);
       const result=await retryDeletions();
       status({state:result.pending?'delete_sync_pending':'delete_synced',count:result.pending});
       return {synced:result.pending===0};
     } catch(error){
       status({state:'delete_sync_pending',error:String(error)});
       return {synced:false};
     }
   }
   return {onReceiptSaved,onReceiptDeleted,recover,retry:async()=>({deletions:await retryDeletions(),backups:await queue.flush()}),pending:()=>queue.pending()+pendingDeletions().length};
 }
 root.CuncunRecentPhoiIntegration={create};
})(typeof window!=='undefined'?window:globalThis);
