const test=require('node:test'),assert=require('node:assert/strict');
const {aggregate}=require('../src/telegram-reconcile.cjs');
const base={user_id:'account-a',date:'2026-10-24',region:'MN',station:'tpho',bet_type:'b',number:'68',unit:'point',amount:10,validated:true};
test('merge same wager from two distinct messages, preserve provenance',()=>{
 const v=aggregate([{...base,chat_id:1,message_id:1,line_id:0},{...base,chat_id:2,message_id:1,line_id:0,amount:20}]);
 assert.equal(v.rows.length,1);assert.equal(v.rows[0].total,30);assert.equal(v.rows[0].sources.length,2);
});
test('dedupe retransmission but not two wagers inside one message',()=>{
 const a={...base,chat_id:1,message_id:1,line_id:0},b={...a,line_id:1};
 const v=aggregate([a,a,b]);assert.equal(v.rows[0].total,20);assert.equal(v.duplicates.length,1);
});
test('never mix stations, regions, bet types or accounts',()=>{
 const a={...base,chat_id:1,message_id:1,line_id:0};
 const cases=[a,{...a,message_id:2,station:'btre'},{...a,message_id:3,region:'MT'},{...a,message_id:4,bet_type:'dd'},{...a,message_id:5,user_id:'account-b'}];
 assert.equal(aggregate(cases).rows.length,5);
});
test('unknown/unvalidated stays unresolved',()=>{
 const v=aggregate([{...base,chat_id:1,message_id:1,line_id:0,validated:false}]);
 assert.equal(v.rows.length,0);assert.equal(v.unresolved.length,1);
});
test('do not mix point and vnd',()=>{
 const v=aggregate([{...base,chat_id:1,message_id:1,line_id:0},{...base,chat_id:1,message_id:2,line_id:0,unit:'vnd',amount:1000}]);
 assert.equal(v.rows.length,2);
});
test('do not mutate source objects',()=>{
 const x={...base,chat_id:1,message_id:1,line_id:0};const before=JSON.stringify(x);
 aggregate([x]);assert.equal(JSON.stringify(x),before);
});
