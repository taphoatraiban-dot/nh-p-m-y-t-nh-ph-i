'use strict';
const fs=require('node:fs'),path=require('node:path');
const {parse}=require('../tests/helpers/production-parser.cjs');
const {reconcile}=require('../src/telegram-reconcile.cjs');
const fixtures=[
 {id:1,group:'Nhóm mẫu A',chat:-1,date:'2026-10-24',raw:'hn\n5645B12.đảo lô 1.',expected:480000},
 {id:2,group:'Nhóm mẫu A',chat:-1,date:'2026-10-24',raw:'hn\n12b10.',expected:270000},
 {id:3,group:'Nhóm mẫu B',chat:-2,date:'2026-10-24',raw:'tpho\n001b0,5.',expected:8500},
 {id:4,group:'Nhóm mẫu C',chat:-3,date:'2026-10-24',raw:'dnang\n123xc10.',expected:20000},
 {id:5,group:'Nhóm mẫu B',chat:-2,date:'2026-10-24',raw:'2dmn\n123xc10.',expected:40000},
 {id:6,group:'Nhóm mẫu A',chat:-1,date:'2026-10-24',raw:'hn\n778877da1.',expected:null}
];
function makeData(){
 const messages=fixtures.map(f=>({...f,...parse(f.raw,f.date)}));
 const records=messages.flatMap(m=>m.errors.length?[]:m.rows.map((r,i)=>({
  user_id:'demo',chat_id:m.chat,message_id:m.id,line_id:i,date:m.date,
  region:{N:'MN',T:'MT',B:'MB'}[r.region],station:r.station,bet_type:r.type,
  number:r.numbers.join('-'),unit:'vnd',amount:r.gross*1000,validated:true,
  raw_text:m.raw,source:'telegram',parser_version:'production-preview'
 })));
 return {messages,records};
}
function build(){
 const data=makeData();
 const core=fs.readFileSync(path.join(__dirname,'../src/telegram-reconcile.cjs'),'utf8');
 const safe=JSON.stringify(data).replace(/</g,'\\u003c');
 return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ÔNG THẦN TÀI · Đối soát xem thử</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f6f7f9;color:#20232a;font:15px system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:24px 16px}header{display:flex;align-items:center;gap:12px;justify-content:space-between}h1{font-size:25px;margin:6px 0}.tag{font-size:12px;font-weight:800;color:#a41924;background:#ffe7e9;padding:8px 12px;border-radius:20px}.intro{color:#59616d;line-height:1.6}.notice{background:#fff4d8;border:1px solid #ebd18d;padding:14px;border-radius:12px;line-height:1.6}.filters{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}label{font-size:12px;font-weight:700;display:grid;gap:6px}select,button{font:inherit;padding:10px;border:1px solid #cbd0d8;border-radius:9px;background:white}button{cursor:pointer}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{padding:18px;background:white;border:1px solid #e0e3e8;border-radius:14px}.card span{font-size:12px;color:#59616d}.card strong{display:block;font-size:25px;margin-top:8px}.section{background:white;border:1px solid #e0e3e8;border-radius:14px;padding:18px;margin-top:18px}h2{font-size:17px;margin:0 0 12px}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;white-space:nowrap}th,td{text-align:left;padding:12px 10px;border-bottom:1px solid #edf0f4;font-size:13px}th{color:#606875;font-size:12px}.money{text-align:right;font-weight:700}.ok{color:#137348}.bad{color:#b42330}pre{white-space:pre-wrap;word-break:break-word;background:#f6f7f9;padding:12px;border-radius:8px;font:14px ui-monospace,monospace}.message{border-bottom:1px solid #e7e9ed;padding:12px 0}.small{font-size:12px;color:#69717c;line-height:1.6}summary{cursor:pointer;font-weight:650}.empty{color:#69717c;padding:16px}@media(max-width:600px){main{padding:16px 10px}h1{font-size:20px}header{align-items:flex-start}.cards{grid-template-columns:1fr}.card{padding:14px}.card strong{font-size:24px}.filters label{flex:1;min-width:120px}.section{padding:12px}}
</style><main><header><div><div class="small">ÔNG THẦN TÀI</div><h1>Đối soát theo nguồn tin</h1></div><span class="tag">XEM THỬ</span></header>
<p class="intro">Kiểm tra tiền xác từ tin nhập, xem tổng theo miền, đài, kiểu chơi và truy lại từng tin nguồn.</p>
<div class="notice">Đây là dữ liệu mẫu, không đọc tài khoản hoặc tin Telegram thật. Tổng là <b>tiền xác (đồng)</b>, chưa áp dụng bảng giá nhận, hồi hoặc tiền trúng. Tin lỗi không được đưa vào tổng.</div>
<div class="filters"><label>Ngày<select id="date"><option value="2026-10-24">24/10/2026</option></select></label><label>Miền<select id="region"><option value="">Tất cả miền</option><option>MN</option><option>MT</option><option value="MB">HN / MB</option></select></label><label>Nhóm nguồn<select id="chat"><option value="">Tất cả nhóm</option><option value="-1">Nhóm mẫu A</option><option value="-2">Nhóm mẫu B</option><option value="-3">Nhóm mẫu C</option></select></label><label>Thử gửi lại tin<button id="replay" type="button" aria-pressed="false">Gửi lại toàn bộ mẫu</button></label></div>
<div class="cards"><div class="card"><span>Tổng từ bộ phân tích</span><strong id="actual"></strong></div><div class="card"><span>Tổng kỳ vọng của mẫu</span><strong id="expected"></strong></div><div class="card"><span>Chênh lệch</span><strong id="delta"></strong></div></div>
<p id="status" role="status" aria-live="polite"></p>
<section class="section"><h2>Bảng tổng đối soát</h2><div class="scroll"><table><thead><tr><th>Miền</th><th>Đài / nhóm đài</th><th>Kiểu chơi</th><th>Nguồn</th><th>Số dòng</th><th class="money">Tiền xác</th></tr></thead><tbody id="summary"></tbody></table></div></section>
<section class="section"><h2>Tin nguồn và kết quả từng tin</h2><div id="messages"></div></section><p class="small">Mỗi tin lỗi khóa toàn bộ tin đó. Bộ mẫu chỉ xác minh các tình huống đã liệt kê; chưa phải chứng nhận mọi cú pháp, lịch mở thưởng hay thu/bù/trúng. Cặp hoặc nhóm đài được giữ nguyên, không tự chia tiền sang từng đài.</p></main>
<script>(()=>{const api=(()=>{const module={exports:{}};
${core}
return module.exports;})();
const {reconcile}=api, data=${safe};
const el=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('vi-VN')+' đ';
const group=id=>data.messages.find(m=>m.chat===id)?.group||String(id);
let replay=false;
function cell(tr,value,cls){const td=document.createElement('td');td.textContent=value;if(cls)td.className=cls;tr.append(td);}
function render(){
 const region=el('region').value,chat=el('chat').value,date=el('date').value;
 const messages=data.messages.filter(m=>m.date===date&&(!chat||String(m.chat)===chat)&&(!region||(m.rows.some(r=>({N:'MN',T:'MT',B:'MB'}[r.region])===region))||(m.errors.length&&region==='MB')));
 const ids=new Set(messages.map(m=>m.id));let records=data.records.filter(r=>ids.has(r.message_id));
 const result=reconcile(replay?[...records,...records]:records);
 const actual=result.rows.reduce((s,r)=>s+Number(r.total_decimal),0),expected=messages.reduce((s,m)=>s+(m.expected??0),0);
 el('actual').textContent=fmt(actual);el('expected').textContent=fmt(expected);el('delta').textContent=fmt(actual-expected);el('delta').className=actual===expected?'ok':'bad';
 const bad=messages.filter(m=>m.errors.length).length;
 el('status').textContent=messages.length+' tin mẫu · '+bad+' tin cần kiểm tra · '+result.duplicates.length+' dòng phát lại đã bỏ qua'+(bad?' — chưa đủ điều kiện chốt.':'');
 el('summary').replaceChildren();for(const r of result.summary){const tr=document.createElement('tr');[r.region,r.station,r.bet_type,group(r.chat_id),r.line_count].forEach(v=>cell(tr,v));cell(tr,fmt(r.total_decimal),'money');el('summary').append(tr);}
 el('messages').replaceChildren();for(const m of messages){const d=document.createElement('details');d.className='message';const title=document.createElement('summary');title.textContent=group(m.chat)+' · Tin '+m.id+' · '+(m.errors.length?'Cần kiểm tra':fmt(m.rows.reduce((s,r)=>s+r.gross*1000,0)));title.className=m.errors.length?'bad':'ok';d.append(title);const pre=document.createElement('pre');pre.textContent=m.raw;d.append(pre);const p=document.createElement('p');p.className='small';p.textContent=m.errors.length?m.errors.join(' / '):m.rows.map(r=>r.numbers.join('-')+' '+r.type+' · '+r.points+' điểm · '+fmt(r.gross*1000)).join(' | ');d.append(p);el('messages').append(d);}
}
['region','chat','date'].forEach(id=>el(id).addEventListener('change',render));el('replay').onclick=()=>{replay=!replay;el('replay').setAttribute('aria-pressed',String(replay));el('replay').textContent=replay?'Đang kiểm tra gửi lặp — tắt':'Gửi lại toàn bộ mẫu';render();};render();})();</script></html>`;
}
if(require.main===module)fs.writeFileSync(path.join(__dirname,'../doi-soat-thu.html'),build());
module.exports={build,makeData};
