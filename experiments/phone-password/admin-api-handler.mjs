// Opt-in LOCAL admin API handler. NOT mounted by phone-http-api.mjs.
// Requires independent, server-verified administrator session (not phone_session).
export function createAdminApiHandler({store, verifyAdmin, verifyCsrf}) {
 if (!store || typeof verifyAdmin!=='function' || typeof verifyCsrf!=='function') throw new TypeError('SECURITY_DEPENDENCIES_REQUIRED');
 return async function handle(req) {
  const admin=await verifyAdmin(req);
  if (!admin || admin.authenticated!==true || !['owner','admin'].includes(admin.role) || !admin.id)
   return {status:403,body:{error:'ADMIN_REQUIRED'}};
  if (req.method==='GET' && req.url==='/admin/phone/pending') {
   const rows=await store.listPending({limit:50});
   return {status:200,body:{accounts:rows}};
  }
  if (req.method==='POST' && req.url==='/admin/phone/grants') {
   if (!await verifyCsrf(req,admin)) return {status:403,body:{error:'CSRF_REJECTED'}};
   const body=req.body;
   if (JSON.stringify(body??{}).length>4096) return {status:413,body:{error:'BODY_TOO_LARGE'}};
   if (!body || typeof body!=='object' || Array.isArray(body) ||
       typeof body.accountId!=='string' ||
       !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.accountId) ||
       !['approve','deny','revoke'].includes(body.action) ||
       (body.action==='approve' && !['1m','3m','12m','permanent'].includes(body.term)))
    return {status:400,body:{error:'INVALID_INPUT'}};
   const result=await store.applyAction({admin,accountId:body.accountId,action:body.action,term:body.term});
   return {status:200,body:{grant:result}};
  }
  return {status:404,body:{error:'NOT_FOUND'}};
 };
}
