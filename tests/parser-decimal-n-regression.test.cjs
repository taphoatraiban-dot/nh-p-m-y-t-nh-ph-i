'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {parse}=require('./helpers/production-parser.cjs');
const html=fs.readFileSync('index.html','utf8');

test('strict unknown-token scanner keeps n attached to decimal stake',()=>{
 const marker='const alphaRuns=[...s.matchAll(';
 const start=html.indexOf(marker);
 assert.ok(start>=0,'strict scanner not found');
 const tail=html.slice(start+marker.length);
 const match=tail.match(/^(\/[^\n]+?\/g)\)\];/);
 assert.ok(match,'scanner regex not found');
 const pattern=Function('return '+match[1])();
 const valid=/^(?:xdao|xcdao|daoxc|dxc|b7ldao|b7ld|b7lo|baobay|bao7|bao8|b8l|bao2|bl2|xcdau|xcduoi|xdau|xduoi|dau|dui|duoi|dd|xc|x|bdao|daob|dv|da|b)\d*(?:[,.]\d+)?n?$/i;
 for(const input of ['519b0,5n.','619b0,5n.','208b0,5n.','223b3,5n.','715b0,5n.','793b5n.']){
  const tokens=[...input.matchAll(pattern)].map(x=>x[0]);
  assert.deepEqual(tokens,[input.slice(3,-1)],input);
  assert.ok(tokens.every(x=>valid.test(x)),input);
 }
 for(const bad of ['519duau0,5n.','519b0,5xyz.']){
  const tokens=[...bad.matchAll(pattern)].map(x=>x[0]);
  assert.ok(tokens.some(x=>!valid.test(x)),bad);
 }
});
for(const wager of ['519b0,5n.','619b0,5n.','208b0,5n.','223b3,5n.','715b0,5n.','793b5n.']){
 test('production parser accepts decimal n: '+wager,()=>{
  const result=parse('2dmn\n'+wager);
  assert.deepEqual(result.errors,[]);
  assert.ok(result.rows.length>0);
 });
}
