const test=require('node:test');
const assert=require('node:assert/strict');
const {validateNotification}=require('../../experiments/zalo-chat/notification-envelope.cjs');
const now=1800000000000;
const good={source:'macos_notification',id:'macnotice_123456',sender:'Khách A',text:'2dmn\n12b1.',timestamp:now,kind:'personal'};
test('accepts fresh notification but never marks it verified',()=>{
 const r=validateNotification(good,now);
 assert.equal(r.ok,true);assert.equal(r.event.verified,false);
 assert.equal(r.event.requiresManualReview,true);
 assert.equal(r.event.text,good.text);
});
test('rejects unsupported sources and hidden notification content',()=>{
 assert.equal(validateNotification({...good,source:'zalo_database'},now).ok,false);
 assert.equal(validateNotification({...good,text:''},now).ok,false);
});
test('rejects stale or future notifications',()=>{
 assert.equal(validateNotification({...good,timestamp:now-3600000},now).ok,false);
 assert.equal(validateNotification({...good,timestamp:now+3600000},now).ok,false);
});
test('rejects oversized payload and malformed IDs',()=>{
 assert.equal(validateNotification({...good,text:'a'.repeat(12001)},now).ok,false);
 assert.equal(validateNotification({...good,id:'1'},now).ok,false);
});
