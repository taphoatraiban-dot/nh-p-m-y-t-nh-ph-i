/* One-time guided installer for a Mac Mini owned by the Cuncun operator.
 * Node 20+, macOS; no npm, Xcode, sudo, CUPS, or AirPrint required.
 * Does NOT send credentials anywhere except the operator's own Supabase API.
 */
'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const readline=require('node:readline/promises');

const PROJECT='https://zigpqddlhvjbjrwhfhaa.supabase.co';
const WORKER_URL='https://raw.githubusercontent.com/taphoatraiban-dot/nh-p-m-y-t-nh-ph-i/feature/cuncun-six-print-methods-preview/scripts/mac-one-tap/worker.cjs';
const WORKER_SHA256='8a7f7e7e837d6c42e12616c492406ca4bf05e826827809adea0f4714fb6c68e9';
const LABEL='icu.cuncun.print-worker';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const xml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

async function secretPrompt(){
  const input=process.stdin,output=process.stdout;
  if(!input.isTTY)throw Error('Cần mở Terminal trực tiếp trên Mac để nhập khóa an toàn.');
  output.write('Dán khóa service_role từ Supabase (sẽ KHÔNG hiện ký tự): ');
  return await new Promise((resolve,reject)=>{
    let value='';input.setRawMode(true);input.resume();
    function finish(err){input.off('data',onData);input.setRawMode(false);output.write('\n');err?reject(err):resolve(value.trim());}
    function onData(chunk){
      const chars=chunk.toString('utf8');
      for(const ch of chars){
        if(ch==='\r'||ch==='\n'){finish();return;}
        if(ch==='\u0003'){finish(Error('Đã hủy.'));return;}
        if(ch==='\u007f'){value=value.slice(0,-1);continue;}
        value+=ch;
      }
    }
    input.on('data',onData);
  });
}

async function authorizedUsers(key,emails){
  const wanted=new Set(emails.map(v=>v.toLowerCase()));
  const found=new Map();
  for(let page=1;page<=100&&found.size<wanted.size;page++){
    const uri=PROJECT+'/auth/v1/admin/users?page='+page+'&per_page=200';
    const res=await fetch(uri,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000)});
    if(!res.ok)throw Error('Không xác minh được service_role tại Supabase (HTTP '+res.status+').');
    const body=await res.json(),users=body.users||[];
    for(const user of users){if(wanted.has(String(user.email||'').toLowerCase()))found.set(user.email.toLowerCase(),user.id);}
    if(users.length<200)break;
  }
  if(found.size!==wanted.size)throw Error('Không tìm được một hoặc nhiều email đăng nhập. Không cài bộ nhận lệnh.');
  const ids=[...found.values()];
  if(ids.some(id=>!uuid.test(id)))throw Error('UUID tài khoản Supabase không hợp lệ.');
  return ids;
}

async function main(){
  if(process.platform!=='darwin')throw Error('Chỉ chạy chương trình này trên Mac Mini.');
  if(Number(process.versions.node.split('.')[0])<20)throw Error('Cần Node 20 trở lên.');
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  const appDir=path.join(os.homedir(),'Library','Application Support','CuncunPrinter');
  const plist=path.join(os.homedir(),'Library','LaunchAgents',LABEL+'.plist');
  console.log('\nCUNCUN — CÀI LẠI IN PHƠI QUA MAC MINI');
  console.log('Không đụng dữ liệu phơi hoặc tài khoản. Máy cũ CUPS không được sử dụng.');
  const ip=(await rl.question('IP máy in [192.168.1.159]: ')).trim()||'192.168.1.159';
  if(!/^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip))throw Error('IP máy in phải thuộc mạng LAN 192.168.x.x.');
  const response=await fetch(WORKER_URL,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Không tải được bộ nhận lệnh từ GitHub (HTTP '+response.status+').');
  const source=await response.text();
  if(crypto.createHash('sha256').update(source).digest('hex')!==WORKER_SHA256)
    throw Error('Bộ nhận lệnh khác phiên bản đã kiểm tra; dừng để bảo vệ máy.');
  // Test one known, non-customer paper before requesting a privileged API key.
  const net=require('node:net');
  await new Promise((resolve,reject)=>{
    const sock=net.connect({host:ip,port:9100});
    sock.setTimeout(5000);
    sock.once('connect',()=>sock.end(Buffer.concat([Buffer.from([27,64]),Buffer.from('CUNCUN - KIEM TRA KET NOI\nMAY IN XPRINTER\n\n\n','ascii')])));
    sock.once('error',reject);
    sock.once('timeout',()=>reject(Error('Khong ket noi duoc Xprinter cong 9100.')));
    sock.once('close',()=>resolve());
  });
  const paper=(await rl.question('Máy in đã ra giấy KIỂM TRA? (co/khong): ')).trim().toLowerCase();
  if(paper!=='co'){console.log('Dừng an toàn; chưa cài bộ nhận lệnh.');rl.close();return;}
  const rawEmails=(await rl.question('Email đăng nhập Cuncun được phép in (nhiều email ngăn bằng dấu phẩy): ')).trim();
  const emails=rawEmails.split(',').map(s=>s.trim()).filter(Boolean);
  if(!emails.length||emails.some(e=>!/^\S+@\S+\.\S+$/.test(e)))throw Error('Email đăng nhập không hợp lệ.');
  rl.close();
  const key=await secretPrompt();
  if(!key.startsWith('eyJ')||key.length<100)throw Error('Cần khóa service_role JWT hợp lệ, không dùng anon/publishable key.');
  const userIds=await authorizedUsers(key,emails);

  fs.mkdirSync(appDir,{recursive:true,mode:0o700});
  fs.chmodSync(appDir,0o700);
  const configFile=path.join(appDir,'config.json');
  if(fs.existsSync(configFile)){
    const backup=path.join(appDir,'config-backup-'+Date.now()+'.json');
    fs.copyFileSync(configFile,backup);fs.chmodSync(backup,0o600);
  }
  const cfg={supabaseUrl:PROJECT,serviceRoleKey:key,userIds,printerIp:ip,printerPort:9100,
    since:new Date().toISOString(),armed:true};
  fs.writeFileSync(configFile,JSON.stringify(cfg,null,2),{mode:0o600});
  fs.chmodSync(configFile,0o600);
  const workerPath=path.join(appDir,'worker.cjs');
  fs.writeFileSync(workerPath,source,{mode:0o600});
  fs.mkdirSync(path.dirname(plist),{recursive:true});
  if(fs.existsSync(plist))fs.copyFileSync(plist,plist+'.backup-'+Date.now());
  const launch=`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${LABEL}</string><key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(workerPath)}</string></array><key>EnvironmentVariables</key><dict><key>TSH_PRINT_CONFIG_FILE</key><string>${xml(configFile)}</string></dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>StandardOutPath</key><string>${xml(path.join(appDir,'worker.log'))}</string><key>StandardErrorPath</key><string>${xml(path.join(appDir,'worker-error.log'))}</string></dict></plist>\n`;
  fs.writeFileSync(plist,launch,{mode:0o600});
  const domain='gui/'+process.getuid();
  try{execFileSync('launchctl',['bootout',domain,plist],{stdio:'ignore'});}catch(_){}
  execFileSync('launchctl',['bootstrap',domain,plist],{stdio:'inherit'});
  console.log('✅ Đã cài bộ nhận lệnh tự chạy mỗi khi đăng nhập Mac.');
  console.log('✅ Chỉ nhận phiếu mới từ '+cfg.since+'. Các phiếu cũ không in lại.');
  console.log('✅ Đã lưu khóa trong file quyền riêng 600 trên Mac; KHÔNG gửi qua website.');
  console.log('Nhật ký: '+path.join(appDir,'worker.log'));
}
main().catch(error=>{console.error('❌ '+(error?.message||error));process.exitCode=1;});
