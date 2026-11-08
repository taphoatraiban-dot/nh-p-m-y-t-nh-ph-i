'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const code=html.match(/<script id="cuncun-desktop-phoi-entry">([\s\S]*?)<\/script>/)[1];
function setup(navigator,{unlocked=false}={}){
 let inserted=[],opened=0,domReads=0;
 const bar={querySelector:()=>null,insertBefore:node=>inserted.push(node)};
 const document={body:{classList:{contains:()=>unlocked}},querySelector:()=>{domReads++;return bar},getElementById:()=>inserted[0],createElement:()=>({addEventListener(event,fn){this[event]=fn}})};
 const context={navigator,document,window:{hidePublicCoverForAuth:()=>opened++}};
 const run=()=>vm.runInNewContext(code,context);run();
 return{inserted,run,opened:()=>opened,domReads:()=>domReads};
}
for(const [name,navigator] of Object.entries({Mac:{platform:'MacIntel',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',maxTouchPoints:0},Windows:{platform:'Win32',userAgent:'Mozilla/5.0 (Windows NT 10.0)',maxTouchPoints:10}})){
 test(name+' mouse entry uses existing authentication and never bypasses it',()=>{
  const s=setup(navigator);assert.equal(s.inserted.length,1);assert.equal(s.inserted[0].textContent,'TÍNH PHƠI');assert.equal(s.inserted[0].type,'button');
  s.inserted[0].click();assert.equal(s.opened(),1);s.run();assert.equal(s.inserted.length,1);
  const unlocked=setup(navigator,{unlocked:true});unlocked.inserted[0].click();assert.equal(unlocked.opened(),0);
 });
}
for(const [name,navigator] of Object.entries({iPhone:{platform:'iPhone',userAgent:'Mozilla/5.0 (iPhone)',maxTouchPoints:5},iPhoneDesktopUA:{platform:'MacIntel',userAgent:'Mozilla/5.0 (Macintosh)',maxTouchPoints:5},iPad:{platform:'MacIntel',userAgent:'Mozilla/5.0 (Macintosh)',maxTouchPoints:5},Android:{platform:'Linux armv8l',userAgent:'Android',maxTouchPoints:5}})){
 test(name+' keeps existing interface without touching DOM',()=>{const s=setup(navigator);assert.equal(s.domReads(),0);assert.equal(s.inserted.length,0);assert.equal(s.opened(),0)});
}
test('entry is hidden in print and CSS is scoped to the new button',()=>{
 const css=html.match(/<style id="cuncun-desktop-phoi-entry-style">([\s\S]*?)<\/style>/)[1];
 assert.match(css,/^\s*#desktopPhoiEntry\{display:none!important\}/);assert.match(css,/@media screen\{/);
 for(const selector of css.matchAll(/([^{}]+)\{/g))assert.ok(selector[1].trim()==='@media screen'||selector[1].trim().startsWith('#desktopPhoiEntry'));
});
