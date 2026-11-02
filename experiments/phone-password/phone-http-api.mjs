// Local-only experimental HTTP API. Never expose this server to the public internet.
// Run with PHONE_AUTH_TEST_DATABASE_URL pointing to a LOOPBACK PostgreSQL database.
// Not a Supabase Auth login; does not authorize existing Cuncun data.
import http from 'node:http';
import { createRequire } from 'node:module';
import { createPhoneAuthService, AuthError } from './phone-auth-service.mjs';
import { createPostgresPhoneStore } from './postgres-phone-store.mjs';

export function createMemoryLimiter({ max = 5, windowMs = 60_000 } = {}) {
  const buckets = new Map();
  return {
    async consume(key) {
      const now = Date.now();
      if (buckets.size > 5000) for (const [k,v] of buckets) if (v.until <= now) buckets.delete(k);
      const old = buckets.get(key);
      const current = !old || old.until <= now ? { count:0, until:now + windowMs } : old;
      current.count++;
      buckets.set(key,current);
      return current.count <= max;
    }
  };
}
export function createPhoneHttpServer(auth) {
  return http.createServer(async (req,res) => {
    const send = (status, body, cookie) => {
      res.writeHead(status, {
        'Content-Type':'application/json; charset=utf-8',
        'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff',
        'Referrer-Policy':'no-referrer',
        'Content-Security-Policy':"default-src 'none'",
        ...(cookie ? {'Set-Cookie':cookie} : {})
      });
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST' || !['/register','/login','/logout','/me'].includes(req.url)) return send(404,{error:'NOT_FOUND'});
    const host = req.headers.host;
    const origin = req.headers.origin;
    // Reject cross-origin browser requests; no CORS headers are emitted.
    if (origin && origin !== 'http://' + host) return send(403,{error:'FORBIDDEN_ORIGIN'});
    if (!host || !/^127\.0\.0\.1:\d+$/.test(host)) return send(403,{error:'LOCAL_ONLY'});
    const clientKey = req.socket.remoteAddress ?? 'unknown';
    try {
      let data = {};
      if (req.url === '/register' || req.url === '/login') {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk.toString('utf8');
          if (Buffer.byteLength(raw,'utf8') > 4096) return send(413,{error:'BODY_TOO_LARGE'});
        }
        try { data = JSON.parse(raw); } catch { return send(400,{error:'INVALID_JSON'}); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return send(400,{error:'INVALID_JSON'});
      }
      const cookie = (req.headers.cookie ?? '').split(';').map(s=>s.trim()).find(s=>s.startsWith('phone_session='));
      const token = cookie?.slice('phone_session='.length);
      if (req.url === '/register') {
        const result = await auth.register({phone:data.phone,password:data.password,clientKey});
        return send(201,result);
      }
      if (req.url === '/login') {
        const result = await auth.login({phone:data.phone,password:data.password,clientKey});
        return send(200,{expiresAt:result.expiresAt,phoneVerified:false},
          'phone_session='+result.token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400');
      }
      if (req.url === '/logout') {
        if (token) await auth.logout(token);
        return send(200,{ok:true},'phone_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      }
      const account = token ? await auth.authenticate(token) : null;
      return account ? send(200,account) : send(401,{error:'UNAUTHORIZED'});
    } catch (err) {
      if (err instanceof AuthError) {
        const status = err.code === 'RATE_LIMITED' ? 429 : err.code === 'INVALID_INPUT' ? 400 : 401;
        return send(status,{error:err.code});
      }
      console.error('Local auth API error:',err?.message);
      return send(500,{error:'INTERNAL_ERROR'});
    }
  });
}
export async function startLocalPhoneApi() {
  const url = process.env.PHONE_AUTH_TEST_DATABASE_URL;
  if (!url || !['127.0.0.1','localhost','::1'].includes(new URL(url).hostname)) throw new Error('Loopback PostgreSQL URL required');
  const require = createRequire(import.meta.url);
  const { Pool } = require('pg');
  const pool = new Pool({connectionString:url,max:4});
  const auth = createPhoneAuthService({store:createPostgresPhoneStore(pool),limiter:createMemoryLimiter()});
  const server = createPhoneHttpServer(auth);
  server.on('close',()=>pool.end());
  server.listen(8787,'127.0.0.1',()=>console.log('LOCAL phone auth API: http://127.0.0.1:8787'));
  return server;
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) startLocalPhoneApi().catch(e=>{console.error(e.message);process.exitCode=1;});
