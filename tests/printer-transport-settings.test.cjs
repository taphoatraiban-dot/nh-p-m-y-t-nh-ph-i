const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const script=html.match(/<script id="cuncun-printer-lan-settings">([\s\S]*?)<\/script>/)?.[1];

test('Menu mới lưu cách in qua Mac Mini và IP, không gọi Supabase',()=>{
  assert.ok(script);
  const fields={
    printerLanIP:{value:'192.168.1.159'},printerLanPort:{value:'9100'},
    printerLanStatus:{textContent:'',className:''},
    printerTransportMode:{value:'relay',addEventListener(){}},
    printerTransportHint:{textContent:''},
    printerLanSave:{addEventListener(_event,callback){this.click=callback}}
  };
  const saved=new Map();
  vm.runInNewContext(script,{
    document:{getElementById:id=>fields[id]},
    localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)}
  });
  fields.printerLanSave.click();
  const cfg=JSON.parse(saved.get('TSH_PRINTER_LAN_V1'));
  assert.equal(cfg.mode,'relay');
  assert.equal(cfg.ip,'192.168.1.159');
  assert.equal(cfg.port,9100);
  fields.printerLanIP.value='999.1.2.3';fields.printerLanSave.click();
  assert.equal(JSON.parse(saved.get('TSH_PRINTER_LAN_V1')).ip,'192.168.1.159');
});

test('Nút IN có 6 tuyến rõ ràng; không tự nhận đã ra giấy',()=>{
  assert.match(html,/mode==='relay'\)printPhoiToMac\(\)/);
  assert.match(html,/mode==='wifi_bridge'\)printPhoiToMac\(false,false,false,false,true\)/);
  assert.match(html,/mode==='native'\)printPhoiToMac\(false,true\)/);
  assert.match(html,/mode==='airprint'\)printPhoiToMac\(false,false,true\)/);
  assert.match(html,/mode==='bluetooth'\)printPhoiToMac\(false,false,false,true\)/);
  assert.match(html,/mode==='share'\)printPhoiToMac\(true\)/);
  for(const mode of ['relay','wifi_bridge','native','airprint','share','bluetooth'])
    assert.match(html,new RegExp('<option value="'+mode+'"'));
  assert.match(html,/Chưa cài bộ điều khiển Wi-Fi riêng/);
  assert.match(html,/Bluetooth cần ứng dụng\/cầu nối máy in tương thích/);
  assert.match(html,/printedResult\?\.airprint/);
  assert.match(html,/Chỉ bấm OK nếu giấy đã in xong/);
  assert.match(html,/body>\*:not\(#tshAirPrintReceipt\)/);
});

test('Hàng đợi Mac không được tự ghi đã in khi vừa lưu lệnh',()=>{
  assert.match(html,/if\(printedResult\?\.queued\)\s*\{/);
  assert.match(html,/printedResult=await waitQueuedPrint\(printedResult\.id\)/);
  assert.match(html,/if\(\['sent','printed','completed'\]\.includes\(state\)\)return \{sent:true,printed:false\}/);
  assert.match(html,/Không gửi lại để tránh in trùng/);
  assert.match(html,/if\(confirm\(question\)\)\s*\{\s*savePrinted/);
});

test('IN NGAY tự lưu phương thức; CHIA SẺ dự phòng dùng luồng in cũ',()=>{
  const saved=new Map();let printClicks=0;
  const button=()=>({addEventListener(_type,cb){this.click=cb}});
  const fields={
    printerLanIP:{value:'192.168.1.159'},printerLanPort:{value:'9100'},
    printerLanStatus:{textContent:'',className:''},
    printerTransportMode:{value:'relay',addEventListener(){}},
    printerTransportHint:{textContent:''},
    printerLanSave:button(),printerPrintNow:button(),printerShareNow:button(),
    printPhoiBluetooth:{click(){printClicks++}}
  };
  vm.runInNewContext(script,{
    document:{getElementById:id=>fields[id]},
    localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
    window:{TSHNativePrintBridge:{available:()=>false}}
  });
  fields.printerPrintNow.click();
  assert.equal(printClicks,1);
  assert.equal(JSON.parse(saved.get('TSH_PRINTER_LAN_V1')).mode,'relay');
  fields.printerShareNow.click();
  assert.equal(printClicks,2);
  assert.equal(JSON.parse(saved.get('TSH_PRINTER_LAN_V1')).mode,'share');
});

test('Khởi tạo mới xóa riêng hai cấu hình in lỗi, giữ nguyên dữ liệu phơi',()=>{
  const saved=new Map([['TSH_PRINTER_LAN_V1',JSON.stringify({
    ip:'192.168.1.159',port:9100,mode:'airprint'
  })],['TSH_PRINTER_CONFIG_V1','old config'],['TSH_PRINT_HISTORY_V1','preserved']]);
  let clicked=0;
  const button=()=>({addEventListener(_type,cb){this.click=cb}});
  const fields={
    printerLanIP:{value:'192.168.1.159'},printerLanPort:{value:'9100'},
    printerLanStatus:{textContent:'',className:''},
    printerTransportMode:{value:'share',addEventListener(){}},
    printerTransportHint:{textContent:''},
    printerLanSave:button(),printerPrintNow:button(),printerShareNow:button(),
    printPhoiBluetooth:{click(){clicked++}}
  };
  vm.runInNewContext(script,{
    document:{getElementById:id=>fields[id]},
    localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},
    window:{TSHNativePrintBridge:{available:()=>true}}
  });
  assert.equal(fields.printerTransportMode.value,'relay');
  assert.equal(saved.has('TSH_PRINTER_CONFIG_V1'),false);
  assert.equal(saved.get('TSH_PRINT_HISTORY_V1'),'preserved');
  fields.printerPrintNow.click();
  assert.equal(clicked,1);
  assert.equal(JSON.parse(saved.get('TSH_PRINTER_LAN_V1')).mode,'relay');
  fields.printerShareNow.click();
  assert.equal(clicked,2);
  assert.equal(JSON.parse(saved.get('TSH_PRINTER_LAN_V1')).mode,'share');
});
