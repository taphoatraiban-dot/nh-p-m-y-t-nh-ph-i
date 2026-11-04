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
     const userId=await getUserId();
     if(!userId){status({state:'not_authenticated'});return {queued:false};}
     // Persist before initiating Wi-Fi printing, then upload asynchronously.
     queue.enqueue(receipt,userId);
     status({state:'pending',count:queue.pending()});
     const result=await queue.flush();
     status({state:result.error?'pending':'synced',count:result.pending});
     return result;
   }
   async function recover(){
     const userId=await getUserId();
     if(!userId) throw new Error('Authenticated user required');
     const remote=await helper.restore({supabase,userId});
     if(await getUserId()!==userId) throw new Error('Account changed during restore');
     const local=await readLocal();
     if(await getUserId()!==userId) throw new Error('Account changed during restore');
     const merged=helper.mergeRestored(local,remote);
     if(merged.length>local.length) await writeLocal(merged);
     status({state:'restored',count:merged.length-local.length});
     return {restored:merged.length-local.length,total:merged.length};
   }
   return {onReceiptSaved,recover,retry:()=>queue.flush(),pending:()=>queue.pending()};
 }
 root.CuncunRecentPhoiIntegration={create};
})(typeof window!=='undefined'?window:globalThis);
