/* Mac-only one-tap receipt worker. Node 20+, no npm dependencies.
 * SECURITY: never place SUPABASE_SERVICE_ROLE_KEY in a website or Git repo.
 * Starts in DRY RUN; only jobs created after process startup are eligible.
 */
'use strict';
const net=require('node:net');
const crypto=require('node:crypto');
const fs=require('node:fs');

const ownerPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const configFile=process.env.TSH_PRINT_CONFIG_FILE||'';
const config=configFile?JSON.parse(fs.readFileSync(configFile,'utf8')):{};
const base=process.env.TSH_SUPABASE_URL||config.supabaseUrl||'';
const key=process.env.TSH_SUPABASE_SERVICE_ROLE_KEY||config.serviceRoleKey||'';
const owner=process.env.TSH_PRINT_USER_ID||config.userId||'';
const printerHost=process.env.TSH_PRINTER_IP||config.printerIp||'192.168.1.159';
const printerPort=Number(process.env.TSH_PRINTER_PORT||config.printerPort||9100);
const armed=process.env.TSH_PRINT_ARMED==='YES'||config.armed===true;
// Persist this timestamp across Mac restarts so pending slips aren't silently lost.
const startedAt=process.env.TSH_PRINT_SINCE||config.since||new Date().toISOString();
const ENDPOINT='/rest/v1/print_queue';

function checkConfiguration(){
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base))throw Error('TSH_SUPABASE_URL phải là HTTPS Supabase.');
  if(!key||key.length<32)throw Error('Thiếu khóa service-role lưu RIÊNG trên Mac Mini.');
  if(!ownerPattern.test(owner))throw Error('TSH_PRINT_USER_ID phải là UUID tài khoản sở hữu phiếu.');
  if(!/^192\.168\.\d{1,3}\.\d{1,3}$/.test(printerHost))throw Error('Máy in phải nằm trong LAN 192.168.x.x.');
  if(!Number.isInteger(printerPort)||printerPort<1||printerPort>65535)throw Error('Cổng TCP không hợp lệ.');
  if(!Number.isFinite(Date.parse(startedAt)))throw Error('TSH_PRINT_SINCE không hợp lệ.');
}
function header(){return {apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json',Prefer:'return=representation'};}
async function api(path,{method='GET',data}={}){
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),10000);
  try{
    const res=await fetch(base+ENDPOINT+path,{method,headers:header(),body:data===undefined?undefined:JSON.stringify(data),signal:ac.signal});
    if(!res.ok)throw Error('Supabase HTTP '+res.status);
    return res.status===204?[]:await res.json();
  }finally{clearTimeout(timer);}
}
function qrCommand(payload){
  const b=Buffer.from(payload,'utf8');
  if(b.length>400)throw Error('QR quá dài.');
  const len=b.length+3;
  return Buffer.concat([
    Buffer.from([29,40,107,4,0,49,65,50,0]), // QR model 2
    Buffer.from([29,40,107,3,0,49,67,5]),   // 5-dot modules
    Buffer.from([29,40,107,3,0,49,69,49]),  // error level M
    Buffer.from([29,40,107,len&255,len>>8,49,80,48]),b,
    Buffer.from([29,40,107,3,0,49,81,48])   // print QR
  ]);
}
function ticketBytes(text){
  if(typeof text!=='string'||text.length>16000||!text.trim())throw Error('Phiếu rỗng hoặc quá dài.');
  const code=text.match(/(?:MA PHIEU|MÃ PHIẾU):\s*([A-Z0-9-]{3,64})/i)?.[1];
  // Raw ESC/POS text: remove accents and strip control bytes (prevents command injection).
  const sanitized=text.replace(/\[\[QR:[^\]]*\]\]/gi,'').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D')
    .replace(/[^\x0a\x20-\x7e]/g,'?').slice(0,16000);
  const parts=[Buffer.from([27,64]),Buffer.from('PHIEU MUA HANG\n'+sanitized+'\n','ascii')];
  if(code){
    parts.push(Buffer.from('QR MA PHIEU (CHUA XAC THUC)\n','ascii'));
    parts.push(qrCommand('CUNCUN:PHIEU:'+code));
  }
  parts.push(Buffer.from('\n\n\n','ascii'));
  return Buffer.concat(parts);
}
function printTcp(bytes,host=printerHost,port=printerPort){
  return new Promise((resolve,reject)=>{
    const socket=net.connect({host,port});
    let settled=false;
    function done(err){if(settled)return;settled=true;socket.destroy();err?reject(err):resolve();}
    socket.setTimeout(10000);
    socket.once('connect',()=>socket.end(bytes));
    socket.once('timeout',()=>done(Error('Máy in không phản hồi.')));
    socket.once('error',done);
    socket.once('close',hadError=>{if(!hadError)done();});
  });
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function pollOnce(){
  const q=new URLSearchParams({select:'id,print_text',status:'eq.pending',user_id:'eq.'+owner,
    created_at:'gte.'+startedAt,order:'created_at.asc',limit:'3'});
  const jobs=await api('?'+q);
  for(const job of jobs){
    if(!Number.isSafeInteger(job.id)||typeof job.print_text!=='string')continue;
    // Dry-run intentionally does NOT claim jobs or print customer information to logs.
    if(!armed){console.log('DRY RUN: job #'+job.id+' đang chờ; chưa gửi máy in.');continue;}
    const claim=await api('?id=eq.'+job.id+'&user_id=eq.'+owner+'&status=eq.pending',{
      method:'PATCH',data:{status:'processing',attempts:1}
    });
    if(!Array.isArray(claim)||claim.length!==1)continue;
    try{
      await printTcp(ticketBytes(job.print_text));
      await api('?id=eq.'+job.id+'&user_id=eq.'+owner+'&status=eq.processing',{
        method:'PATCH',data:{status:'sent',error_message:null}
      });
      console.log('Đã gửi dữ liệu TCP cho phiếu #'+job.id+' (chưa xác nhận giấy ra).');
    }catch(error){
      await api('?id=eq.'+job.id+'&user_id=eq.'+owner+'&status=eq.processing',{
        method:'PATCH',data:{status:'failed',error_message:String(error.message||error).slice(0,200)}
      });
      console.error('Lỗi gửi phiếu #'+job.id+': '+String(error.message||error));
    }
  }
}
async function main(){
  checkConfiguration();
  console.log(armed?'ĐÃ BẬT IN TCP':'CHẾ ĐỘ THỬ (KHÔNG IN)');
  console.log('Chỉ nhận phiếu MỚI từ lúc khởi động. Không đọc dữ liệu các tài khoản khác.');
  while(true){try{await pollOnce();}catch(e){console.error('Lỗi hàng đợi: '+e.message);}await sleep(2500);}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={checkConfiguration,ticketBytes,qrCommand,pollOnce,printTcp};
