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

const {reconcile}=require('../src/telegram-reconcile.cjs');
const sample=(patch={})=>({...base,chat_id:-1001,message_id:1,line_id:0,...patch});
test('conflicting content quarantines all versions regardless of arrival order',()=>{
 const a=sample(),b=sample({amount:20});
 for(const input of [[a,b],[b,a],[a,b,a]]){
  const r=aggregate(input);assert.equal(r.accepted,0);assert.deepEqual(r.rows,[]);
  assert.equal(r.unresolved[0].reason,'source_conflict');
 }
});
test('invalid then valid version is never silently accepted',()=>{
 const r=aggregate([sample({validated:false}),sample()]);
 assert.equal(r.accepted,0);assert.equal(r.unresolved[0].reason,'source_conflict');
});
test('same content in different messages and chats remains independent',()=>{
 const r=aggregate([sample(),sample({message_id:2}),sample({chat_id:-1002})]);
 assert.equal(r.accepted,3);assert.equal(r.rows[0].total,30);
});
test('arrival retry preserves original provenance without double count',()=>{
 const a=sample({raw_text:'hn 68b10',source:'telegram',parser_version:'v1',received_at:'first'});
 const r=aggregate([a,{...a,received_at:'second'}]);
 assert.equal(r.accepted,1);assert.equal(r.duplicates.length,1);
 assert.equal(r.rows[0].sources[0].raw_text,a.raw_text);
 assert.equal(r.rows[0].sources[0].received_at,'first');
});
for(const field of ['raw_text','revision','parser_version','source']) test('review changed '+field,()=>{
 assert.equal(aggregate([sample({[field]:'a'}),sample({[field]:'b'})]).unresolved[0].reason,'source_conflict');
});
for(const value of [null,undefined,42,{},[],sample({chat_id:0}),sample({message_id:-1}),sample({line_id:-1}),sample({chat_id:Number.MAX_SAFE_INTEGER+1})])
 test('reject malformed source '+JSON.stringify(value),()=>{
  const r=aggregate([value]);assert.equal(r.accepted,0);assert.equal(r.unresolved.length,1);
 });
for(const patch of [{date:'2026-02-30'},{date:'2026-2-3'},{date:'junk'},{validated:'yes'},
 {number:68},{number:''},{station:' '},{bet_type:null},{unit:'nghin'},
 {amount:NaN},{amount:Infinity},{amount:-1},{amount:'10'},{amount:0.0000001},
 {amount:Number.MAX_SAFE_INTEGER},{region:'HN'},{source:{}}])
 test('review invalid normalized field '+JSON.stringify(patch),()=>{
  const r=aggregate([sample(patch)]);assert.equal(r.accepted,0);assert.equal(r.unresolved.length,1);
 });
test('decimal amounts are summed exactly and zero is represented correctly',()=>{
 const r=aggregate([sample({amount:0.1}),sample({amount:0.2,message_id:2})]);
 assert.equal(r.rows[0].total,0.3);assert.equal(r.rows[0].total_decimal,'0.3');
 assert.equal(aggregate([sample({amount:0})]).rows[0].total_decimal,'0');
});
test('large totals retain exact decimal without unsafe numeric projection',()=>{
 const r=aggregate([sample({amount:9007199254}),sample({amount:9007199254,message_id:2})]);
 assert.equal(r.rows[0].total,null);assert.equal(r.rows[0].total_decimal,'18014398508');
});
test('preserve leading zero, date, account and unit boundaries',()=>{
 const r=aggregate([sample({number:'01'}),sample({number:'1',message_id:2}),
 sample({date:'2026-10-25',message_id:3}),sample({user_id:'b'}),sample({unit:'vnd',message_id:4})]);
 assert.equal(r.rows.length,5);
});
test('summary separates sources and excludes unresolved lines',()=>{
 const r=reconcile([sample({amount:0.1}),sample({amount:0.2,line_id:1}),
 sample({source:'forwarded',message_id:2}),sample({chat_id:-1002}),sample({validated:false,message_id:3})]);
 assert.equal(r.summary.length,3);assert.equal(r.summary[0].total_decimal,'0.3');
 assert.equal(r.summary[0].message_count,1);assert.equal(r.summary[0].line_count,2);
 assert.equal(r.complete,false);assert.equal(r.accepted,4);
});
test('60 groups, two accounts and replay: no loss, no cross-account merge',()=>{
 const input=[];
 for(const user_id of ['a','b'])for(let chat=1;chat<=60;chat++)for(let msg=1;msg<=100;msg++)
  input.push(sample({user_id,chat_id:-chat,message_id:msg,amount:0.1}));
 const before=JSON.stringify(input),r=reconcile([...input,...input]);
 assert.equal(r.accepted,12000);assert.equal(r.duplicates.length,12000);assert.equal(r.unresolved.length,0);
 assert.equal(r.rows.length,2);assert.ok(r.rows.every(x=>x.total_decimal==='600'));
 assert.equal(r.summary.length,120);assert.ok(r.summary.every(x=>x.total_decimal==='10'&&x.message_count===100));
 assert.equal(JSON.stringify(input),before);assert.equal(r.complete,true);
});
test('empty input is safe and non-list input is rejected',()=>{
 assert.deepEqual(reconcile([]).summary,[]);assert.throws(()=>aggregate(null),TypeError);
});
