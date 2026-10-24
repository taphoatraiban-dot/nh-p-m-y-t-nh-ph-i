'use strict';
// Pure, read-only preview of multi-source accounting; NOT connected to production bets.
// Each record must ALREADY be validated/normalized by the existing parser.
function aggregate(input){
 if(!Array.isArray(input))throw Error('Expected list');
 const seen=new Set(),totals=new Map(),unresolved=[],duplicates=[];
 for(const r of input){
  const id=[r.user_id,r.chat_id,r.message_id,r.line_id].join('|');
  if(!r.user_id||!Number.isSafeInteger(r.chat_id)||!Number.isSafeInteger(r.message_id)||!Number.isSafeInteger(r.line_id)){
   unresolved.push({id,reason:'source_identifiers_missing'});continue;
  }
  if(seen.has(id)){duplicates.push(id);continue;}seen.add(id);
  if(!r.validated||!['MN','MT','MB'].includes(r.region)||!r.date||!r.station||!r.bet_type||!r.number||
   !['point','vnd'].includes(r.unit)||typeof r.amount!=='number'||!Number.isFinite(r.amount)||r.amount<0){
   unresolved.push({id,reason:'requires_review'});continue;
  }
  const key=JSON.stringify([r.user_id,r.date,r.region,r.station,r.bet_type,r.number,r.unit]);
  const row=totals.get(key)||{user_id:r.user_id,date:r.date,region:r.region,station:r.station,bet_type:r.bet_type,number:r.number,unit:r.unit,total:0,sources:[]};
  row.total+=r.amount;
  row.sources.push({chat_id:r.chat_id,message_id:r.message_id,line_id:r.line_id,amount:r.amount});
  totals.set(key,row);
 }
 return {rows:[...totals.values()],unresolved,duplicates,accepted:seen.size-unresolved.filter(x=>x.reason==='requires_review').length};
}
module.exports={aggregate};
