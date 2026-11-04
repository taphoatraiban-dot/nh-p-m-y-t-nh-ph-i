const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
test('staging backup bootstrap stays disabled until explicit authenticated start',()=>{
 const ctx={Promise};ctx.globalThis=ctx;
 const source=fs.readFileSync(path.join(__dirname,'../src/phoi-recent-bootstrap.js'),'utf8');
 let attached=0,detached=0;
 ctx.CuncunRecentPhoiHooks={attach(){attached++},detach(){detached++}};
 ctx.CuncunRecentPhoiPrintBridge={create:()=>({recover:async()=>({restored:2}),retry:async()=>({}),pending:()=>0,saved(){},deleted(){}})};
 vm.runInNewContext(source,ctx);
 const api=ctx.CuncunRecentPhoiBootstrap;
 assert.equal(api.active(),false);
 assert.equal(attached,0);
 assert.throws(()=>api.start({}),/Supabase client required/);
 const client=api.start({supabase:{from(){}},getUserId:async()=> 'user',storage:{getItem(){},setItem(){}}});
 assert.equal(api.active(),true);
 assert.equal(attached,1);
 assert.throws(()=>api.start({}),/already started/);
 assert.equal(client.pending(),0);
 api.stop();assert.equal(detached,1);assert.equal(api.active(),false);
});
test('HTML loads dependencies and only starts backup through explicit authenticated control',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const paths=['phoi-recent-backup.js','phoi-recent-integration.js','phoi-recent-print-bridge.js','phoi-recent-print-hooks.js','phoi-recent-bootstrap.js'];
 let last=-1;
 for(const name of paths){const pos=html.indexOf('src/'+name);assert.ok(pos>last,name);last=pos;}
 assert.match(html,/CuncunRecentPhoiControl\s*=\s*\{/);
 assert.match(html,/async enable\(\)/);
 assert.match(html,/sb\.auth\.getUser\(\)/);
 assert.match(html,/CuncunRecentPhoiBootstrap\.start\s*\(/);
 assert.doesNotMatch(html,/CuncunRecentPhoiControl\.enable\s*\(/);
});
