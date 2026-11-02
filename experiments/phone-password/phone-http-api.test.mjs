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

test('phone API never exposes admin approval endpoints', async t => {
 const server=createPhoneHttpServer({});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const pending=await fetch(base+'/admin/phone/pending');
 assert.equal(pending.status,404);
 const grant=await fetch(base+'/admin/phone/grants',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:'11111111-1111-4111-8111-111111111111',action:'approve',term:'1m'})});
 assert.equal(grant.status,404);
});
test('preview route accepts harmless query parameters', async t => {
 const server=createPhoneHttpServer({});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url='http://127.0.0.1:'+server.address().port+'/phone-auth-preview.html?utm_source=test';
 const response=await fetch(url);
 assert.equal(response.status,200);
 assert.ok(response.headers.get('content-type').includes('text/html'));
});

test('staging preview is served locally with restricted Supabase-only CSP', async t => {
 const server=createPhoneHttpServer({});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url='http://127.0.0.1:'+server.address().port+'/phone-auth-staging-preview.html';
 const response=await fetch(url);
 assert.equal(response.status,200);
 assert.ok(response.headers.get('content-type').includes('text/html'));
 const csp=response.headers.get('content-security-policy')||'';
 assert.match(csp,/https:\/\/\*\.supabase\.co/);
 assert.match(csp,/https:\/\/cdn\.jsdelivr\.net/);
 const html=await response.text();
 assert.match(html,/phone-password-auth/);
 assert.match(html,/ĐĂNG KÝ/);
 assert.match(html,/TẢI TÀI KHOẢN CHỜ/);
});
