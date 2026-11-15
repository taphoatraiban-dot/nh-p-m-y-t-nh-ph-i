'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../../supabase/functions/receipt-verify/index.ts'),'utf8').replace(/^import[^\n]+\n/gm,''));
// Execute the real HTTP handler with an in-memory, owner-filtered Data API.
function setup(initial=[]){
 const rows=structuredClone(initial),queries=[];let handler,uid='owner-a';
 const db={auth:{getUser:async token=>({data:{user:token==='valid'&&uid?{id:uid}:null},error:null})},from(table){
  const filters=[],orders=[];let update,deleted=false,single=false,fields='*',offset=0,count=Infinity;
  const q={select(s){fields=s;return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){filters.push(r=>r[k]===v);return q},not(k,op,v){filters.push(r=>r[k]!==v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},order(k,o={}){orders.push([k,o.ascending!==false]);return q},range(a,b){offset=a;count=b-a+1;return q},limit(n){count=n;return q},maybeSingle(){single=true;return q},update(v){update=v;return q},delete(){deleted=true;return q},then(resolve){
   queries.push({table,update,deleted});
   let matched=(table==='receipt_verifications'?rows:[]).filter(r=>filters.every(f=>f(r)));
   for(const [k,asc] of orders.toReversed())matched.sort((a,b)=>(a[k]<b[k]?-1:a[k]>b[k]?1:0)*(asc?1:-1));
   matched=matched.slice(offset,offset+count);
   if(update)matched.forEach(r=>Object.assign(r,update));
   if(deleted)throw Error('The archive API must never delete rows');
   const data=matched.map(r=>fields==='*'?structuredClone(r):Object.fromEntries(fields.split(',').map(k=>[k,r[k]])));
   return Promise.resolve(resolve({data:single?(data[0]||null):data,error:null}));
  }};return q;
 }};
 vm.runInNewContext(source,{createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handler=fn},crypto,TextEncoder,Response,URL,console});
 return {rows,queries,user:v=>uid=v,async call(action,body={},token='valid'){
  const response=await handler(new Request('https://example.test',{method:'POST',headers:token?{authorization:'Bearer '+token}:{},body:JSON.stringify({action,...body})}));
  return {status:response.status,body:await response.json()};
 }};
}
module.exports={setup};
