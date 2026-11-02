import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalAdminHttpBridge} from './local-admin-http-bridge.mjs';
test('refuses nonlocal bridge configuration',()=>assert.throws(()=>createLocalAdminHttpBridge({handle:async()=>({}),host:'0.0.0.0'}),/LOCAL_ADMIN_HANDLER_REQUIRED/));
test('rejects missing handler',()=>assert.throws(()=>createLocalAdminHttpBridge(),/LOCAL_ADMIN_HANDLER_REQUIRED/));
test('localhost bridge enforces origin and forwards guarded request',async()=>{
 const server=createLocalAdminHttpBridge({handle:async req=>({status:req.headers.authorization?200:403,body:{ok:true}})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const port=server.address().port,url='http://127.0.0.1:'+port+'/admin/phone/pending';
  let r=await fetch(url,{headers:{Origin:'https://evil.example'}});assert.equal(r.status,403);
  r=await fetch(url,{headers:{Authorization:'Bearer token'}});assert.equal(r.status,200);
  r=await fetch(url);assert.equal(r.status,403);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('rejects invalid JSON and unsupported content type',async()=>{
 const server=createLocalAdminHttpBridge({handle:async()=>({status:200,body:{ok:true}})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/admin/phone/grants';
  let r=await fetch(url,{method:'POST',body:'{}',headers:{'Content-Type':'text/plain'}});assert.equal(r.status,415);
  r=await fetch(url,{method:'POST',body:'{',headers:{'Content-Type':'application/json'}});assert.equal(r.status,400);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
