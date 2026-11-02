// Run against a locally started staging server. No production calls or credentials.
// node experiments/phone-password/staging-http-smoke.mjs
import assert from 'node:assert/strict';
const port=Number(process.env.PORT||8787);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('INVALID_PORT');
const base='http://127.0.0.1:'+port;
async function probe(path,body,headers={}){
 const response=await fetch(base+path,{method:'POST',headers,body});
 return {status:response.status,body:await response.json()};
}
const path='/api/staging-auth/phone/login';
const valid={'Origin':base,'Content-Type':'application/json'};
const tests=[
 ['missing Origin',()=>probe(path,'{}',{'Content-Type':'application/json'}),403],
 ['wrong Origin',()=>probe(path,'{}',{'Origin':'https://example.com','Content-Type':'application/json'}),403],
 ['wrong Content-Type',()=>probe(path,'{}',{'Origin':base,'Content-Type':'text/plain'}),415],
 ['null JSON',()=>probe(path,'null',valid),400],
 ['array JSON',()=>probe(path,'[]',valid),400],
 ['invalid JSON',()=>probe(path,'{',valid),400],
 ['missing fields',()=>probe(path,'{}',valid),400],
 ['unknown endpoint',()=>probe('/api/staging-auth/nope','{}',valid),404],
];
for(const [name,run,expected] of tests){
 const result=await run();
 assert.equal(result.status,expected,name+' returned '+result.status+' instead of '+expected);
 assert.equal(typeof result.body.message,'string',name+' missing message');
 console.log('PASS',name,'HTTP',result.status);
}
console.log('All',tests.length,'local HTTP checks passed. No accounts created.');
