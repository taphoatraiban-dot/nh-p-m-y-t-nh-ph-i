const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const script=html.match(/<script id="cuncun-printer-lan-settings">([\s\S]*?)<\/script>/)?.[1];

test('Menu lưu riêng kiểu in AirPrint và IP, không gọi Supabase',()=>{
  assert.ok(script);
  const fields={
    printerLanIP:{value:'192.168.1.159'},printerLanPort:{value:'9100'},
    printerLanStatus:{textContent:'',className:''},
    printerTransportMode:{value:'airprint',addEventListener(){}},
    printerTransportHint:{textContent:''},
    printerLanSave:{addEventListener(_event,callback){this.click=callback}}
  };
  const saved=new Map();
  vm.runInNewContext(script,{
    document:{getElementById:id=>fields[id]},
    localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}
  });
  fields.printerLanSave.click();
  const cfg=JSON.parse(saved.get('TSH_PRINTER_LAN_V1'));
  assert.equal(cfg.mode,'airprint');
  assert.equal(cfg.ip,'192.168.1.159');
  assert.equal(cfg.port,9100);
  fields.printerLanIP.value='999.1.2.3';fields.printerLanSave.click();
  assert.equal(JSON.parse(saved.get('TSH_PRINTER_LAN_V1')).ip,'192.168.1.159');
});

test('Nút IN chọn tuyến riêng; AirPrint không giả vờ đã ra giấy',()=>{
  assert.match(html,/mode==='airprint'\)printPhoiToMac\(false,false,true\)/);
  assert.match(html,/mode==='native'\)printPhoiToMac\(false,true\)/);
  assert.match(html,/printedResult\?\.airprint/);
  assert.match(html,/Chỉ bấm OK nếu giấy đã in xong/);
  assert.match(html,/body>\*:not\(#tshAirPrintReceipt\)/);
});

test('IN NGAY tự lưu phương thức; CHIA SẺ dự phòng dùng luồng in cũ',()=>{
  const saved=new Map();let printClicks=0;
  const button=()=>({addEventListener(_type,cb){this.click=cb}});
  const fields={
    printerLanIP:{value:'192.168.1.159'},printerLanPort:{value:'9100'},
    printerLanStatus:{textContent:'',className:''},
    printerTransportMode:{value:'airprint',addEventListener(){}},
    printerTransportHint:{textContent:''},
    printerLanSave:button(),printerPrintNow:button(),printerShareNow:button(),
    printPhoiBluetooth:{click(){printClicks++}}
  };
  vm.runInNewContext(script,{
    document:{getElementById:id=>fields[id]},
    localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},
    window:{TSHNativePrintBridge:{available:()=>false}}
  });
  fields.printerPrintNow.click();
  assert.equal(printClicks,1);
  assert.equal(JSON.parse(saved.get('TSH_PRINTER_LAN_V1')).mode,'airprint');
  fields.printerTransportMode.value='native';
  fields.printerPrintNow.click();
  assert.equal(printClicks,1,'Không gửi lệnh giả khi thiếu ứng dụng native');
  assert.match(fields.printerLanStatus.textContent,/Chưa có ứng dụng/);
  fields.printerShareNow.click();
  assert.equal(printClicks,2);
  assert.equal(JSON.parse(saved.get('TSH_PRINTER_LAN_V1')).mode,'share');
});
