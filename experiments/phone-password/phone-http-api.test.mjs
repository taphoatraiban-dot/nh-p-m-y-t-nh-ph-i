import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryLimiter, createPhoneHttpServer } from './phone-http-api.mjs';
test('limiter blocks repeated attempts', async () => {
 const limiter=createMemoryLimiter({max:2,windowMs:10000});
 assert.equal(await limiter.consume('ip'),true);
 assert.equal(await limiter.consume('ip'),true);
 assert.equal(await limiter.consume('ip'),false);
});
test('HTTP API denies cross-origin and missing local host', async t => {
 const auth={};
 const server=createPhoneHttpServer(auth);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const port=server.address().port;
 const url='http://127.0.0.1:'+port+'/login';
 const response=await fetch(url,{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{}'});
 assert.equal(response.status,403);
});
