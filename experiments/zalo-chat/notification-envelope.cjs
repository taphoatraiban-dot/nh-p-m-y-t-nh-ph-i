/* Safe local bridge envelope validator. No Zalo credentials, network, or filesystem access. */
'use strict';
const MAX_TEXT=12000, MAX_SENDER=160;
function validateNotification(input,now=Date.now()){
 if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,error:'invalid_payload'};
 if(input.source!=='macos_notification')return {ok:false,error:'unverified_source'};
 if(typeof input.id!=='string'||!/^[a-zA-Z0-9_-]{12,100}$/.test(input.id))return {ok:false,error:'invalid_id'};
 if(typeof input.sender!=='string'||!input.sender.trim()||input.sender.length>MAX_SENDER)return {ok:false,error:'invalid_sender'};
 if(typeof input.text!=='string'||!input.text.trim()||input.text.length>MAX_TEXT)return {ok:false,error:'invalid_text'};
 if(!Number.isSafeInteger(input.timestamp)||Math.abs(now-input.timestamp)>5*60*1000)return {ok:false,error:'stale_notification'};
 if(input.kind!=='personal'&&input.kind!=='group'&&input.kind!=='unknown')return {ok:false,error:'invalid_kind'};
 return {ok:true,event:{
  id:input.id,source:'macos_notification',sender:input.sender.trim(),
  text:input.text,timestamp:input.timestamp,kind:input.kind,
  verified:false,requiresManualReview:true
 }};
}
module.exports={validateNotification};
