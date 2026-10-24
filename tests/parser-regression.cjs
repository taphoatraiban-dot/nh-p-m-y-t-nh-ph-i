// Regression suite for production pure normalizers. Run: node --test tests/parser-regression.cjs
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function extract(name){
 const begin=source.indexOf('function '+name+'(');assert.ok(begin>=0,'Missing '+name);
 const start=source.indexOf('{',begin);let depth=0,quote='',escaped=false,line=false,block=false;
 for(let i=start;i<source.length;i++){
  const c=source[i],next=source[i+1];
  if(line){if(c==='\n')line=false;continue;}
  if(block){if(c==='*'&&next==='/'){i++;block=false;}continue;}
  if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue;}
  if(c==='/'&&next==='/'){line=true;i++;continue;}
  if(c==='/'&&next==='*'){block=true;i++;continue;}
  if(c==='"'||c==="'"){quote=c;continue;}
  if(c==='{')depth++;if(c==='}'&&--depth===0)return source.slice(begin,i+1);
 }
 throw Error('Unable to extract '+name);
}
const context=vm.createContext({});
for(const n of ['ttFixCompactBetSeparators','ttNormalizeDaoLoPhrase','ttNormalizeClearNaturalBetNames'])vm.runInContext(extract(n),context,{timeout:1000});
const fix=context.ttFixCompactBetSeparators,dao=context.ttNormalizeDaoLoPhrase,natural=context.ttNormalizeClearNaturalBetNames;
let ncases=0;
for(const a of ['01','12','23','39','68','79','90','99'])
 for(const b of ['07','24','45','63','86','97','98','00'])
  if(a!==b)for(const sep of [':','/','-']){
   ncases++;test('DA '+a+sep+b,()=>assert.equal(fix('2dmn\n'+a+sep+b+'da3.'),'2dmn\n'+a+b+'da3.'));
  }
for(const num of ['1000','2002','3399','4567','5600','7891','8080','9998'])
 for(const stake of ['1','2','10','0,5']){
  ncases++;test('Bao4 '+num+' stake '+stake,()=>assert.equal(fix('hn\n'+num+'.b'+stake+'.'),'hn\n'+num+'b'+stake+'.'));
 }
for(const num of ['123','237','633','636','900','001'])
 for(const phrase of ['dảo xc','đảo xc','dao xc','đào xc','dảo xỉu chủ','đảo xỉu chủ']){
  ncases++;test('XDAO '+num+' '+phrase,()=>assert.equal(natural('hn\n'+num+' '+phrase+'10.'),'hn\n'+num+'xdao10.'));
 }
for(const num of ['6633','5645','9812','0099'])
 for(const phrase of ['đảo lô','đảolô','đàolô','dao lo','đao lô']){
  ncases++;test('BDAO '+num+' '+phrase,()=>assert.equal(dao('hn\n'+num+' '+phrase+'1.'),'hn\n'+num+' bdao1.'));
 }
test('Leave existing wager intact',()=>assert.equal(fix('hn\n3399b2.'),'hn\n3399b2.'));
test('Keep decimal comma',()=>assert.equal(fix('2dmn\n7997da0,5.'),'2dmn\n7997da0,5.'));
test('Keep XC unrelated to DA',()=>assert.equal(fix('hn\n123xc10.'),'hn\n123xc10.'));
assert.ok(ncases>=200,'Expected 200+ cases, got '+ncases);
