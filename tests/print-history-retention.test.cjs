'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function renderHistory(entries){
  const store=new Map([['TSH_PRINT_HISTORY_V1',JSON.stringify(entries)]]);
  const list={innerHTML:''};
  const input={addEventListener(){}};
  const backdrop={
    style:{},
    querySelector(selector){
      if(selector==='#bluetoothPrintList')return list;
      if(selector==='#bluetoothPrintSearch')return input;
      return null;
    },
    addEventListener(){},
    appendChild(){}
  };
  const document={
    body:{appendChild(){}},
    getElementById(){return null;},
    createElement(){return backdrop;},
    addEventListener(){}
  };
  const context={
    document,
    localStorage:{
      getItem:key=>store.get(key)||null,
      setItem:(key,value)=>store.set(key,value)
    },
    Date,
    console
  };
  context.window=context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/bluetooth-print-manager.js'),'utf8'),context);
  context.TSHBluetoothPrintManager.open();
  return {html:list.innerHTML,stored:JSON.parse(store.get('TSH_PRINT_HISTORY_V1'))};
}

test('local print history expires after 24 hours',()=>{
  const now=Date.now();
  const {html,stored}=renderHistory([
    {id:'fresh',raw:'2dmn\n1234da1.',createdAt:now-23*60*60*1000},
    {id:'expired',raw:'2dmn\n5678da1.',createdAt:now-25*60*60*1000}
  ]);
  assert.doesNotMatch(html,/5678|expired/);
  assert.deepEqual(stored.map(row=>row.id),['fresh']);
});

test('history screen states its 24-hour retention window',()=>{
  const {html}=renderHistory([]);
  // The list heading is rendered after the modal template is attached.
  assert.match(html,/Lưu 24 giờ/);
});

const appHtml=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('main app and Telegram inbox honor the 24-hour retention window',()=>{
  assert.ok(appHtml.includes('Date.now()-t<86400000'),'main app print history must expire after one day');
  assert.ok(appHtml.includes('· chỉ 24 giờ gần nhất'),'Telegram UI must state the one-day window');
  assert.ok(appHtml.includes('tin trong 24 giờ'),'inbox summary must state the one-day window');
  assert.ok(!appHtml.includes('172800000'),'main app must not keep history for 48 hours');
  assert.ok(!appHtml.includes('48 giờ'),'UI must not claim a 48-hour window');
});
