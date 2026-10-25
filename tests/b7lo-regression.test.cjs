'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parse}=require('./helpers/production-parser.cjs');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

// Load the production normalizers from index.html without booting the UI.
const from=html.indexOf('function ttFixCompactBetSeparators(');
const to=html.indexOf('function cleanTelegramPhoiText(',from);
assert.ok(from>=0&&to>from,'Production normalization block not found');
const normalizeContext=vm.createContext({});
vm.runInContext(html.slice(from,to),normalizeContext,{timeout:1000});
const normalize=normalizeContext.ttUnifiedNormalize;
assert.equal(typeof normalize,'function','Production unified normalizer not loaded');

const valid=[
  {label:'2-digit canonical token',input:'2dmn\n79b7lo10.',expected:'2dmn\n79b7lo10.'},
  {label:'3-digit canonical token from reported failure',input:'2dmn\n879b7lo10.',expected:'2dmn\n879b7lo10.'},
  {label:'space before stake',input:'2dmn\n879b7lo 10.',expected:'2dmn\n879b7lo 10.'},
  {label:'space before alias',input:'2dmn\n879 b7lo10.',expected:'2dmn\n879 b7lo10.'},
  {label:'spaces around alias',input:'2dmn\n879 b7lo 10.',expected:'2dmn\n879 b7lo 10.'},
  {label:'upper-case alias',input:'2dmn\n879B7LO10.',expected:'2dmn\n879B7LO10.'},
];
for(const c of valid){
  test('b7lo normalization preserves '+c.label,()=>{
    const normalized=normalize(c.input);
    assert.equal(normalized.toLowerCase().replace(/\\s/g,''),c.input.toLowerCase().replace(/\\s/g,''));
    assert.equal(normalized.toLowerCase().includes('bao7'),false);
  });
  test('parser accepts '+c.label,()=>{
    const result=parse(c.input);
    assert.deepEqual(result.errors,[]);
    assert.ok(result.rows.length>0);
    assert.ok(result.rows.every(row=>row.type==='BAO 7'));
  });
}

for(const c of [
  {label:'letter O replaced by zero',input:'2dmn\n879b7l010.'},
  {label:'alias split internally',input:'2dmn\n879b7l o10.'},
  {label:'extra letter after alias',input:'2dmn\n879b7lox10.'},
  {label:'five-digit number outside supported alias lengths',input:'2dmn\n12345b7lo10.'},
]){
  test('near-miss stays invalid and is never rewritten to bao7: '+c.label,()=>{
    const normalized=normalize(c.input);
    assert.equal(normalized.toLowerCase().includes('bao7'),false);
    const result=parse(c.input);
    assert.ok(result.errors.length>0,JSON.stringify(result));
    assert.equal(result.rows.length,0);
  });
}

test('explicit bao7 alias remains accepted as written',()=>{
  const input='2dmn\n879bao710.';
  assert.equal(normalize(input),input);
  const result=parse(input);
  assert.deepEqual(result.errors,[]);
  assert.ok(result.rows.length>0);
  assert.ok(result.rows.every(row=>row.type==='BAO 7'));
});
