#!/usr/bin/env node
'use strict';
// Local-only diagnostic receiver: tests the CUNCUN bridge envelope without reading Zalo data.
const http=require('node:http');
const crypto=require('node:crypto');
const {validateNotification}=require('./notification-envelope.cjs');
const port=Number(process.env.CUNCUN_ZALO_TEST_PORT||47831);
const token=process.env.CUNCUN_ZALO_TEST_TOKEN;
if(!token||Buffer.byteLength(token,'utf8')<24){console.error('Set CUNCUN_ZALO_TEST_TOKEN to a random secret (24+ characters).');process.exit(1);}
const seen=new Set();
const server=http.createServer((req,res)=>{
 const reply=(code,data)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
 if(req.method!=='POST'||req.url!=='/notification')return reply(404,{ok:false});
 const supplied=req.headers['x-cuncun-test-token'];
 const a=Buffer.from(typeof supplied==='string'?supplied:'');
 const b=Buffer.from(token);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return reply(401,{ok:false});
 let body='',bytes=0;
 req.on('data',chunk=>{bytes+=chunk.length;if(bytes>16000){reply(413,{ok:false,error:'payload_too_large'});req.destroy();return;}body+=chunk;});
 req.on('end',()=>{
  let input;try{input=JSON.parse(body);}catch{return reply(400,{ok:false,error:'invalid_json'});}
  const result=validateNotification(input);
  if(!result.ok)return reply(422,result);
  if(seen.has(result.event.id))return reply(409,{ok:false,error:'duplicate'});
  if(seen.size>=500)seen.clear();
  seen.add(result.event.id);
  // Never log message text, sender, credentials, or persist to disk.
  reply(202,{ok:true,id:result.event.id,requiresManualReview:true});
 });
});
server.listen(port,'127.0.0.1',()=>console.log('Local Zalo bridge diagnostic listening on 127.0.0.1:'+port+' (no Zalo connection)'));
