'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../src/admin-customer-live-panel.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function setup({ flag = true, isAdmin = false } = {}) {
  let admin = isAdmin, onAuth = null, observer = null;
  const elements = [], calls = [];
  class Node {
    constructor(tag) { this.tag = tag;this.children=[];this.handlers={};this.value='';this.hidden=false;this.removed=false;this.textContent=''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children=[...nodes]; }
    get firstChild() { return this.children[0]; }
    get childNodes() { return this.children; }
    remove() { this.removed=true; }
    focus() {}
    setAttribute() {}
    addEventListener(name, handler) { this.handlers[name]=handler; }
    dispatch(name) { return this.handlers[name]?.({ preventDefault(){} }); }
  }
  const body = new Node('body');let unlocked = false;
  body.classList={contains(name){return name==='app-unlocked'&&unlocked;}};
  const document={body,head:new Node('head'),createElement(tag){const element=new Node(tag);elements.push(element);return element;},addEventListener(){}};
  const sb={
    auth:{onAuthStateChange(handler){onAuth=handler;}},
    async rpc(name, args){
      calls.push([name,args]);
      if(name==='check_email_license')return {data:{success:true,is_admin:admin},error:null};
      if(name==='admin_customer_overview')return {data:[{account_kind:'registered',user_id:'id-1',email:'demo@example.invalid',license_active:true,expires_at:'2026-12-01T00:00:00Z',device_count:1,revision:0}],error:null};
      if(name==='admin_customer_command')return {data:{success:true,revision:1},error:null};
      throw new Error(name);
    }
  };
  vm.runInNewContext(code,{document,sb,URLSearchParams,location:{search:flag?'?admin_center_candidate=1':''},MutationObserver:class{constructor(fn){observer=fn;}observe(){}},queueMicrotask,crypto:{randomUUID:()=> '12345678-1234-4123-8123-123456789abc'},console});
  return {elements,calls,body,entry:()=>elements.find(e=>e.id==='customerCenterEntry'),root:()=>elements.findLast(e=>e.id==='customerCenterRoot'&&!e.removed),setAdmin(value){admin=value;onAuth?.('SIGNED_IN',null);},setUnlocked(value){unlocked=value;observer?.();}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('candidate requires explicit flag and never performs direct table writes', () => {
  assert.match(code,/admin_center_candidate/);
  assert.match(app,/<script src="src\/admin-customer-live-panel\.js" defer><\/script>/);
  assert.doesNotMatch(code,/\.from\(|\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
  const ui=setup({flag:false});assert.equal(ui.entry(),undefined);
});

test('customer role cannot open or load candidate data', async () => {
  const ui=setup({isAdmin:false});ui.setUnlocked(true);await tick();
  assert.equal(ui.entry().hidden,true);
  ui.entry().dispatch('click');
  assert.equal(ui.root(),undefined);
  assert.equal(ui.calls.some(([name])=>name==='admin_customer_overview'),false);
});

test('authorized Admin can read and preview confirmation without any write', async () => {
  const ui=setup({isAdmin:true});ui.setUnlocked(true);await tick();
  assert.equal(ui.entry().hidden,false);
  ui.entry().dispatch('click');await tick();await tick();
  assert.equal(ui.calls.some(([name])=>name==='admin_customer_overview'),true);
  const detailButton=ui.elements.find(e=>e.tag==='button'&&e.textContent==='Chi tiết');
  detailButton.dispatch('click');
  const form=ui.elements.findLast(e=>e.tag==='form');
  await form.dispatch('submit');
  assert.equal(ui.calls.some(([name])=>name==='admin_customer_command'),false);
});

test('auth session change immediately hides and removes candidate panel', async () => {
  const ui=setup({isAdmin:true});ui.setUnlocked(true);await tick();
  ui.entry().dispatch('click');await tick();
  const opened=ui.root();assert.ok(opened);
  ui.setAdmin(false);
  assert.equal(opened.removed,true);
  assert.equal(ui.entry().hidden,true);
  await tick();assert.equal(ui.entry().hidden,true);
});

test('confirmed action uses guarded command RPC with revision and fresh request ID', async () => {
  const ui=setup({isAdmin:true});ui.setUnlocked(true);await tick();
  ui.entry().dispatch('click');await tick();
  ui.elements.find(e=>e.tag==='button'&&e.textContent==='Chi tiết').dispatch('click');
  const form=ui.elements.findLast(e=>e.tag==='form');
  const email=ui.elements.findLast(e=>e.tag==='input'&&e.type==='email');
  const reason=ui.elements.findLast(e=>e.tag==='textarea');
  email.value='demo@example.invalid';reason.value='Gia hạn theo yêu cầu khách hàng';
  await form.dispatch('submit');
  const command=ui.calls.find(([name])=>name==='admin_customer_command');
  assert.ok(command, JSON.stringify({calls:ui.calls.map(([name])=>name),errors:ui.elements.filter(e=>e.className==='cc-error').map(e=>e.textContent)}));
  assert.equal(command[1].p_action,'extend');
  assert.equal(command[1].p_user_id,'id-1');
  assert.equal(command[1].p_expected_revision,0);
  assert.equal(command[1].p_days,30);
  assert.equal(command[1].p_request_id,'12345678-1234-4123-8123-123456789abc');
});
