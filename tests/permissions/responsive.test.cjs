const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'../..');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(x=>x[1]).join('\n');
const code=html.slice(html.indexOf('function ttProPlaceholder'),html.indexOf('function ttRenderCompactLicense'));
test('permission components at iPhone, Android and desktop viewports',async t=>{
 const browser=await chromium.launch({executablePath:process.env.PW_EXECUTABLE||undefined,headless:true});
 try{for(const [name,width,height] of [['iphone',390,844],['android',412,915],['desktop',1440,900]])await t.test(name,async()=>{
  const page=await browser.newPage({viewport:{width,height}});
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body class="app-unlocked"><main style="max-width:700px;margin:auto;padding:12px"><div id="syntaxGuideEntry"><b id="appEditionBadge"></b></div><div class="legacy-summary">Tổng tiền thu: <b>119k</b></div><h3>XEM CHI TIẾT</h3><div data-pro-report="summary" data-pro-region="N"></div><section class="top10-box"><h3>TOP 10 SỐ LỚN NHẤT</h3><div data-pro-report="top10"></div></section><div id="deviceListSection">Quản lý thiết bị</div></main></body>');
  await page.addScriptTag({content:`const htmlEsc=s=>String(s).replace(/[<&"]/g,'?');const money=n=>Math.ceil(n)+'k';const sb={rpc:async()=>({data:{summary:[{region:'N',type:'Bao 2',gross:123,win:4,thu:119}],top10:[{region:'N',type:'Bao 2',items:[{num:'01',gross:123}]}]}})};`+code});
  await page.evaluate(()=>{document.querySelectorAll('[data-pro-report]').forEach(x=>x.innerHTML=ttProPlaceholder());ttApplyEdition({success:true,active:true,edition:'standard'});});
  assert.equal(await page.locator('.pro-report-label').count(),2);assert(!await page.locator('#deviceListSection').isVisible());assert.equal(await page.locator('.legacy-summary').innerText(),'Tổng tiền thu: 119k');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.PERMISSION_SCREENSHOTS)await page.screenshot({path:path.join(process.env.PERMISSION_SCREENSHOTS,name+'-standard.png'),fullPage:true});
  await page.evaluate(async()=>{ttApplyEdition({success:true,active:true,edition:'pro'});await ttLoadProReports([],{N:119});});assert(!await page.locator('#deviceListSection').isVisible());assert.equal(await page.locator('.sample-type-table tbody tr').count(),2);
  await page.evaluate(()=>ttApplyEdition({success:true,active:true,is_admin:true}));assert(await page.locator('#deviceListSection').isVisible());
  await page.evaluate(()=>ttApplyEdition({success:true,active:true,edition:'standard'}));assert.equal(await page.locator('.pro-report-label').count(),2);assert(!await page.locator('#deviceListSection').isVisible());
  await page.close();
 });}finally{await browser.close();}
});
test('all archived application URLs redirect to canonical entry',async()=>{
 const files=fs.readdirSync(root).filter(n=>/^index.*\.html$/.test(n)&&n!=='index.html');assert.equal(files.length,40);
 for(const file of files){const text=fs.readFileSync(path.join(root,file),'utf8');assert(text.includes("location.replace('./index.html'+location.search+location.hash)"));assert(!text.includes('topNumbers'));}
});
