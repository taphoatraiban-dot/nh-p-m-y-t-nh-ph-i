// LOCAL ONLY: optional HTTP bridge. Never expose publicly.
// Requires injected verified admin handler; no phone_session or mock admin bypass.
import http from 'node:http';
export function createLocalAdminHttpBridge({handle,host='127.0.0.1'}={}){
 if(typeof handle!=='function'||host!=='127.0.0.1')throw new TypeError('LOCAL_ADMIN_HANDLER_REQUIRED');
 return http.createServer(async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host??''))return send(403,{error:'LOCAL_ONLY'});
  if(req.headers.origin && req.headers.origin!=='http://'+req.headers.host)return send(403,{error:'FORBIDDEN_ORIGIN'});
  if(!['/admin/phone/pending','/admin/phone/grants'].includes(req.url))return send(404,{error:'NOT_FOUND'});
  if(req.method!=='GET'&&req.method!=='POST')return send(405,{error:'METHOD_NOT_ALLOWED'});
  if(req.method==='GET'&&req.url!=='/admin/phone/pending')return send(405,{error:'METHOD_NOT_ALLOWED'});
  if(req.method==='POST'&&req.url!=='/admin/phone/grants')return send(405,{error:'METHOD_NOT_ALLOWED'});
  try{
   let body;
   if(req.method==='POST'){
    if(!(req.headers['content-type']??'').startsWith('application/json'))return send(415,{error:'JSON_REQUIRED'});
    let raw='';for await(const chunk of req){raw+=chunk.toString('utf8');if(Buffer.byteLength(raw)>4096)return send(413,{error:'BODY_TOO_LARGE'});}
    try{body=JSON.parse(raw);}catch{return send(400,{error:'INVALID_JSON'});}
   }
   const result=await handle({method:req.method,url:req.url,headers:req.headers,body});
   if(!result||!Number.isInteger(result.status)||result.status<100||result.status>599)return send(500,{error:'INVALID_HANDLER_RESULT'});
   return send(result.status,result.body??{});
  }catch{return send(500,{error:'INTERNAL_ERROR'});}
 });
}
