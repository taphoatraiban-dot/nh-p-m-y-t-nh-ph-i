'use strict';
// Only runs against disposable localhost Auth and database services.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),origin='http://127.0.0.1:55441',auth='http://127.0.0.1:55440';
const secret=process.env.PERMISSION_TEST_JWT_SECRET,password='Local-only-test-Password-2026!';
if(!secret||!process.env.PERMISSION_TEST_LOCAL)throw Error('Disposable local environment required');
const sql=text=>cp.execFileSync('psql',['-h','127.0.0.1','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:text,env:{...process.env,PGPASSWORD:'local-test-db-only'},stdio:['pipe','pipe','pipe']});
const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const token=b({alg:'HS256',typ:'JWT'})+'.'+b({role:'anon',exp:Math.floor(Date.now()/1000)+3600});const anon=token+'.'+crypto.createHmac('sha256',secret).update(token).digest('base64url');
async function main(){
 const accounts=[];
 for(const label of ['standard','pro','admin1','admin2']){
  const email='release-'+label+'@example.com';const r=await fetch(auth+'/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});const d=await r.json();assert(r.ok&&d.user?.id,'signup '+label+': '+JSON.stringify(d));const id=d.user.id;accounts.push({label,email,id});
  const admin=label.startsWith('admin');sql("INSERT INTO public.profiles(id,role,edition) VALUES('"+id+"','"+(admin?'admin':'user')+"','"+(label==='standard'?'standard':'pro')+"');INSERT INTO public.email_licenses(user_id,email,expires_at,active) VALUES('"+id+"','"+email+"',now()+interval '1 day',true);"+(admin?"INSERT INTO public.admin_users(user_id) VALUES('"+id+"');":""));
 }
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replaceAll('https://zigpqddlhvjbjrwhfhaa.supabase.co',origin).replace(/const SUPABASE_PUBLISHABLE_KEY="[^"]+"/,'const SUPABASE_PUBLISHABLE_KEY="'+anon+'"');
 const server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,origin);const isAuth=u.pathname.startsWith('/auth/v1/'),isRest=u.pathname.startsWith('/rest/v1/');
  if(isAuth||isRest){const prefix=isAuth?'/auth/v1':'/rest/v1';const chunks=[];for await(const ch of req)chunks.push(ch);const headers={...req.headers};delete headers.host;delete headers['content-length'];const r=await fetch((isAuth?auth:'http://127.0.0.1:55439')+u.pathname.slice(prefix.length)+u.search,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});res.writeHead(r.status,{'content-type':r.headers.get('content-type')||'application/json'});res.end(Buffer.from(await r.arrayBuffer()));return;}
  if(u.pathname.startsWith('/functions/')){res.writeHead(404,{'content-type':'application/json'});res.end('{"error":"No unrelated functions in isolated environment"}');return;}
  const rel=decodeURIComponent(u.pathname).replace(/^\/+/, '')||'index.html';const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep))throw Error('invalid path');const body=rel==='index.html'?html:fs.readFileSync(file);res.writeHead(200,{'content-type':rel.endsWith('.js')?'application/javascript':rel.endsWith('.css')?'text/css':rel.endsWith('.html')?'text/html':'application/octet-stream'});res.end(body);
 }catch(e){res.writeHead(404);res.end('not found');}});
 await new Promise(r=>server.listen(55441,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.PW_EXECUTABLE||undefined,headless:true});let passes=0;
 try{for(const [name,width,height] of [['iphone',390,844],['android',412,915],['desktop',1440,900]])for(const a of accounts){
  const context=await browser.newContext({viewport:{width,height},isMobile:name!=='desktop',hasTouch:name!=='desktop'});await context.route('**/*',r=>{const u=new URL(r.request().url());return ['127.0.0.1','localhost','cdn.jsdelivr.net'].includes(u.hostname)||u.protocol==='data:'?r.continue():r.abort();});const page=await context.newPage();
  page.on('dialog',d=>d.type()==='prompt'?d.accept('2468'):d.accept());await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof showFullLogin==='function',null,{timeout:30000});await page.evaluate(()=>showFullLogin());await page.locator('#email').fill(a.email);await page.locator('#password').fill(password);await page.locator('#loginBtn').click();
  try{await page.waitForFunction(()=>document.body.classList.contains('app-unlocked'),null,{timeout:30000});}catch(e){throw Error('login '+name+'/'+a.label+': '+await page.locator('#loginStatus').innerText());}
  await page.waitForSelector('#ottChatOpen',{state:'attached'});
  if(a.label==='standard'){assert.equal(await page.locator('#ottChatOpen').isVisible(),false);assert.equal(await page.locator('#telegramProNotice').isVisible(),true);const denied=await page.evaluate(async()=>{const r=await fetch('/functions/v1/telegram-chat?action=status',{method:'POST',body:'{}'});return r.status;});assert.equal(denied,403);}else{assert.equal(await page.locator('#ottChatOpen').isVisible(),true);}
  const admin=a.label.startsWith('admin');assert.equal(await page.evaluate(()=>document.body.dataset.admin),String(admin));assert.equal(await page.evaluate(()=>document.body.dataset.edition),a.label==='standard'?'standard':'pro');
  await page.evaluate(()=>{document.querySelector('#date').value='2026-10-24';document.querySelector('#bets').value='tpho\n01b1.';const p=parseBets();if(p.errors.length)throw Error(JSON.stringify(p.errors));renderCalculation(p.rows,p.errors,readCustomer());});
  if(a.label==='standard'){await page.locator('.pro-report-label').first().waitFor();assert.equal(await page.locator('[data-pro-report] .sample-type-table').count(),0);}else{await page.locator('[data-pro-report] .sample-type-table').first().waitFor({state:'attached',timeout:30000});assert(await page.locator('[data-pro-report="top10"] .top10-type').count()>0);}
  const response=await page.evaluate(async()=>{const r=await sb.rpc('admin_list_devices');return {error:!!r.error,data:r.data};});assert.equal(response.error,!admin);assert(await page.locator('.total-table').count()>0);
  await page.evaluate(()=>doLogout());await page.waitForFunction(()=>!document.body.classList.contains('app-unlocked'));assert.equal(await page.evaluate(()=>document.body.dataset.admin),'false');console.log('PASS real login/calculation/reports/Admin API/logout: '+name+'/'+a.label);passes++;await context.close();
 }console.log('TOTAL '+passes+' full-page real-auth sessions passed');}finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
