/* Integration adapter. Must be explicitly wired to the real receipt-save path.
   Do not automatically intercept print buttons or infer receipt IDs. */
(function(root){
 'use strict';
 function create({supabase,getUserId,storage,readLocal,writeLocal,onStatus}){
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
     const merged=helper.mergeRestored(local,remote);
     if(merged.length>local.length){
       if(await getUserId()!==userId) throw new Error('Account changed before restore write');
       await writeLocal(merged);
     }
     status({state:'restored',count:merged.length-local.length});
     return {restored:merged.length-local.length,total:merged.length};
   }
   return {onReceiptSaved,recover,retry:()=>queue.flush(),pending:()=>queue.pending()};
 }
 root.CuncunRecentPhoiIntegration={create};
})(typeof window!=='undefined'?window:globalThis);
