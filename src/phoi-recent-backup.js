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
    return (data||[]).filter(row=>allowedDays(now).includes(row.receipt_day)).map(row=>assertReceipt(row.receipt_snapshot));
  }
  root.CuncunRecentPhoiBackup={dayKey,allowedDays,backup,restore};
})(typeof window!=='undefined'?window:globalThis);
