'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const bootCode=html.slice(html.indexOf('let authBootPromise=null;'),html.indexOf('// ===== BẢO MẬT PHIÊN ĐĂNG NHẬP ====='));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};};
function setup(overrides={}){
 const calls=[];
 const c=vm.createContext({sb:{auth:{getSession:async()=>({data:{session:{user:{email:'demo@example.test'}}}}),signOut:async()=>calls.push('signOut')}},getSavedPin:()=>true,cloudPinHash:async()=>true,cloudRestoreSettings:async()=>calls.push('restore'),showPinLock:()=>calls.push('pin'),showLogin:()=>calls.push('login'),showFullLogin:()=>calls.push('full'),loginStatus:()=>calls.push('status'),...overrides});
 vm.runInContext(bootCode,c);return{c,calls,boot:()=>vm.runInContext('boot()',c)};
}
test('startup executes once even if two callers request it',async()=>{
 let count=0;const wait=deferred();const {boot,calls}=setup({sb:{auth:{getSession:()=>{count++;return wait.promise;}}}});
 const a=boot(),b=boot();assert.equal(a,b);assert.equal(count,1);
 wait.resolve({data:{session:{user:{email:'demo@example.test'}}}});await a;assert.equal(calls.filter(x=>x==='pin').length,1);
});
test('local PIN is displayed without waiting for settings or remote PIN',async()=>{
 const never=deferred();const {boot,calls}=setup({cloudPinHash:()=>{throw Error('must not request remote PIN');},cloudRestoreSettings:()=>never.promise});
 await boot();assert.deepEqual(calls,['pin']);
});
test('remote-only PIN displays after lookup',async()=>{
 const {boot,calls}=setup({getSavedPin:()=>false});await boot();assert.equal(calls[0],'pin');
});
test('no session selects login once',async()=>{
 const {boot,calls}=setup({sb:{auth:{getSession:async()=>({data:{session:null}})}}});await boot();assert.deepEqual(calls,['login']);
});
test('session failure shows password fallback without rejecting startup',async()=>{
 const {boot,calls}=setup({sb:{auth:{getSession:async()=>{throw Error('offline');}}}});await boot();assert.deepEqual(calls,['full','status']);
});
test('late session lookup cannot replace a manually selected login flow',async()=>{
 const wait=deferred();const {boot,c,calls}=setup({sb:{auth:{getSession:()=>wait.promise}}});const task=boot();vm.runInContext('authBootEpoch++',c);wait.resolve({data:{session:{user:{email:'demo@example.test'}}}});await task;assert.deepEqual(calls,[]);
});
test('no configured PIN requires password and never opens app',async()=>{
 const {boot,calls}=setup({getSavedPin:()=>false,cloudPinHash:async()=>''});await boot();assert.deepEqual(calls,['signOut','full','status']);
});
for(const name of ['showPinLock','showLogin'])test(name+' preserves a swipe to the auth screen',()=>{
 const start=html.indexOf('function '+name+'('),end=html.indexOf('\n}',start)+2;
 const noop=()=>{},cls={add:noop,remove:noop,contains:x=>x==='public-auth-open'};
 const node={classList:cls,value:'',focus:noop};let covers=0;
 const context=vm.createContext({document:{body:{classList:cls},getElementById:()=>node},$:()=>node,stopIdleLogout:noop,refreshPinDots:noop,showPublicCover:()=>covers++,setTimeout:noop});
 vm.runInContext(html.slice(start,end),context);context[name]('demo@example.test');assert.equal(covers,0);
});
test('only one main boot call remains and INITIAL_SESSION does not reset view',()=>{
 assert.equal(html.slice(0,html.indexOf('// ===== V3 UI =====')).match(/^boot\(\);$/gm).length,1);
 const a=html.indexOf('sb.auth.onAuthStateChange((event,session)=>{'),b=html.indexOf('\nboot();',a);assert.ok(a>0&&b>a);
 let cb,shown=0;const c=vm.createContext({authBootEpoch:0,sb:{auth:{onAuthStateChange:fn=>cb=fn}},showLogin:()=>shown++});
 vm.runInContext(html.slice(a,b),c);cb('INITIAL_SESSION',null);assert.equal(shown,0);cb('SIGNED_OUT',null);assert.equal(shown,1);assert.equal(c.authBootEpoch,1);
});
