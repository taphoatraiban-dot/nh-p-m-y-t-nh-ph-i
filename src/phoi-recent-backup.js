/* CUNCUN: isolated backup helper. Not wired to production print flow yet.
   Storage table and RLS must be provisioned before enabling. */
(function(root){
  'use strict';
  const TZ='Asia/Ho_Chi_Minh';
  function dayKey(value){
    const d=new Date(value);
    if(Number.isNaN(d.getTime())) throw new Error('Invalid receipt timestamp');
    return new Intl.DateTimeFormat('sv-SE',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  }
  function allowedDays(now=new Date()){
    const today=dayKey(now);
    const yesterday=dayKey(new Date(now.getTime()-86400000));
    return [today,yesterday];
  }
  function assertReceipt(receipt){
    if(!receipt || typeof receipt!=='object' || Array.isArray(receipt)) throw new Error('Receipt required');
    if(typeof receipt.id!=='string'||!receipt.id.trim()) throw new Error('Stable receipt id required');
    if(!receipt.created_at) throw new Error('Receipt creation time required');
    if(Number.isNaN(new Date(receipt.created_at).getTime())) throw new Error('Invalid receipt creation time');
    return receipt;
  }
  async function backup({supabase,userId,receipt,now=new Date()}){
    assertReceipt(receipt);
    if(!userId) throw new Error('Authenticated user required');
    const day=dayKey(receipt.created_at);
    if(!allowedDays(now).includes(day)) return {skipped:true,reason:'outside_today_yesterday'};
    const row={owner_user_id:userId,receipt_id:receipt.id,receipt_day:day,receipt_snapshot:receipt,updated_at:new Date().toISOString()};
    const {error}=await supabase.from('phoi_recent_backups').upsert(row,{onConflict:'owner_user_id,receipt_id'});
    if(error) throw error;
    return {saved:true};
  }
  async function restore({supabase,userId,now=new Date()}){
    if(!userId) throw new Error('Authenticated user required');
    const {data,error}=await supabase.from('phoi_recent_backups').select('receipt_id,receipt_day,receipt_snapshot').eq('owner_user_id',userId).in('receipt_day',allowedDays(now));
    if(error) throw error;
    return (data||[]).filter(row=>{
      if(!allowedDays(now).includes(row.receipt_day)) return false;
      try {
        const receipt=assertReceipt(row.receipt_snapshot);
        return receipt.id===row.receipt_id && dayKey(receipt.created_at)===row.receipt_day;
      } catch { return false; }
    }).map(row=>row.receipt_snapshot);
  }
  // Optional integration: call only after the receipt has been saved locally.
  // A network failure must never prevent printing; surface the failure for retry.
  function createBackupQueue({supabase,getUserId,storage,storageKey='cuncun_pending_phoi_backups'}){
    function read(){
      try {const v=JSON.parse(storage.getItem(storageKey)||'[]');return Array.isArray(v)?v:[];}
      catch {return [];}
    }
    function write(rows){storage.setItem(storageKey,JSON.stringify(rows));}
    function enqueue(receipt,userId){
      assertReceipt(receipt);
      if(!userId) throw new Error('Authenticated user required');
      const rows=read().filter(x=>!(x && x.userId===userId && x.receipt && x.receipt.id===receipt.id));
      rows.push({userId,receipt});
      write(rows);
      return rows.length;
    }
    let flushing=null;
    async function flush(now=new Date()){
      if(flushing) return flushing;
      flushing=flushOnce(now);
      try{return await flushing;}finally{flushing=null;}
    }
    async function flushOnce(now){
      const userId=await getUserId();
      if(!userId) return {saved:0,pending:read().length,error:'not_authenticated'};
      let saved=0,failed=false;
      const completed=new Map();
      const snapshot=read();
      for(const item of snapshot){
        if(!item || !item.receipt || !item.userId) {failed=true;continue;}
        if(item.userId!==userId) continue;
        const key=item.userId+'\\u0000'+item.receipt.id;
        // Malformed queue entries must not abort syncing valid receipts.
        let receiptDay;
        try {assertReceipt(item.receipt);receiptDay=dayKey(item.receipt.created_at);}
        catch {failed=true;continue;}
        if(!allowedDays(now).includes(receiptDay)){completed.set(key,JSON.stringify(item));continue;}
        try{
          // A user may switch accounts while an earlier flush is awaiting the network.
          if(await getUserId()!==userId){failed=true;break;}
          await backup({supabase,userId,receipt:item.receipt,now});
          saved++;completed.set(key,JSON.stringify(item));
        }
        catch{failed=true;}
      }
      // Re-read to preserve new receipts enqueued while the network was busy.
      const remaining=read().filter(item=>{
        if(!item || !item.receipt || !item.userId) return true;
        const key=item.userId+'\\u0000'+item.receipt.id;
        return completed.get(key)!==JSON.stringify(item);
      });
      write(remaining);
      return {saved,pending:remaining.length,error:failed?'retry_required':null};
    }
    return {enqueue,flush,pending:()=>read().length};
  }
  // Merge only by stable ID. Never replace the existing local print history.
  function mergeRestored(localReceipts,remoteReceipts,now=new Date()){
    if(!Array.isArray(localReceipts)||!Array.isArray(remoteReceipts)) throw new Error('Receipt arrays required');
    const byId=new Map();
    for(const item of localReceipts){
      if(!item || typeof item.id!=='string' || !item.id.trim()) continue;
      byId.set(item.id,item);
    }
    for(const item of remoteReceipts){
      assertReceipt(item);
      if(!allowedDays(now).includes(dayKey(item.created_at))) continue;
      if(!byId.has(item.id)) byId.set(item.id,item);
    }
    return Array.from(byId.values());
  }
  root.CuncunRecentPhoiBackup={dayKey,allowedDays,backup,restore,createBackupQueue,mergeRestored};
})(typeof window!=='undefined'?window:globalThis);
