const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const bridgeCode=fs.readFileSync(path.join(__dirname,'../src/ios-native-print-bridge.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

test('Safari không báo hỗ trợ in TCP trực tiếp',()=>{
  const ctx={window:{},setTimeout,clearTimeout};
  vm.runInNewContext(bridgeCode,ctx);
  assert.equal(ctx.window.TSHNativePrintBridge.available(),false);
  assert.throws(()=>ctx.window.TSHNativePrintBridge.send('phiếu'),/ứng dụng Cucun Printer/);
});

test('ứng dụng iOS gửi phiếu và chỉ xác nhận đã chuyển dữ liệu',async()=>{
  let message;
  const win={
    webkit:{messageHandlers:{tshPrinter:{postMessage:m=>{message=m;}}}},
    TSHIOSSharePhoi:{render:()=>({toDataURL:()=> 'data:image/png;base64,ZmFrZQ=='})}
  };
  vm.runInNewContext(bridgeCode,{window:win,setTimeout,clearTimeout});
  const api=win.TSHNativePrintBridge;
  assert.equal(api.available(),true);
  const pending=api.send('phoi');
  assert.equal(message.png,'data:image/png;base64,ZmFrZQ==');
  assert.equal(api.resolve(message.id,{ok:true}),true);
  assert.equal((await pending).printed,false);
});

test('nút in và nút chia sẻ độc lập, có script bridge trong website',()=>{
  assert.match(html,/id="printPhoiBluetooth"/);
  assert.match(html,/id="printPhoiDirect"/);
  assert.match(html,/src="src\/ios-native-print-bridge.js"/);
  assert.match(html,/printPhoiToMac\(false,true\)/);
  assert.match(html,/TSHNativePrintBridge\?\.available\(\)/);
});
