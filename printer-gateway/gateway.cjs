/* Dedicated local ESC/POS gateway for a future Wi-Fi print-box.
   Never expose this listener directly to the Internet. Default: loopback only.
   A trusted HTTPS relay with authentication is required for remote iPhone/5G use. */
'use strict';
const http=require('node:http');
const net=require('node:net');
const crypto=require('node:crypto');

const MAX_BODY=32*1024;
const MAX_PRINT_BYTES=64*1024;
const HOST=process.env.TSH_GATEWAY_BIND||'127.0.0.1';
const PORT=Number(process.env.TSH_GATEWAY_PORT||8788);
const PRINTER_HOST=process.env.TSH_PRINTER_IP||'';
const PRINTER_PORT=Number(process.env.TSH_PRINTER_PORT||9100);
const TOKEN=process.env.TSH_GATEWAY_TOKEN||'';

function authorized(header,token){
  if(token.length<32||typeof header!=='string'||!header.startsWith('Bearer '))return false;
  const incoming=Buffer.from(header.slice(7));
  const expected=Buffer.from(token);
  return incoming.length===expected.length&&crypto.timingSafeEqual(incoming,expected);
}
function receiptBytes(text){
  if(typeof text!=='string'||!text.trim()||text.length>MAX_BODY)throw Error('Nội dung phiếu không hợp lệ.');
  // Text mode is an initial connectivity test. This does not print secure QR or
  // guarantee Vietnamese characters; those require a validated raster driver.
  const ascii=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D')
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g,'?');
  const data=Buffer.concat([Buffer.from([0x1b,0x40]),Buffer.from(ascii+'\n\n\n')]);
  if(data.length>MAX_PRINT_BYTES)throw Error('Phiếu quá dài.');
  return data;
}
function sendToPrinter(bytes,host,port,connect=net.createConnection){
  return new Promise((resolve,reject)=>{
    let done=false;
    const finish=(err)=>{if(done)return;done=true;err?reject(err):resolve();};
    const socket=connect({host,port});
    socket.setTimeout(5000);
    socket.once('connect',()=>socket.end(bytes));
    socket.once('timeout',()=>{socket.destroy();finish(Error('Máy in không phản hồi.'));});
    socket.once('error',finish);
    socket.once('close',hadError=>{if(!hadError)finish();});
  });
}
function createHandler(config,send=sendToPrinter){
  return async(req,res)=>{
    const respond=(code,obj)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
    if(req.method!=='POST'||req.url!=='/print')return respond(404,{error:'Not found'});
    if(!authorized(req.headers.authorization,config.token))return respond(401,{error:'Unauthorized'});
    if(req.headers['content-type']?.split(';')[0]!=='application/json')return respond(415,{error:'Expected application/json'});
    try{
      let size=0,chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)throw Error('Dữ liệu vượt giới hạn.');chunks.push(chunk);}
      const {text}=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      await send(receiptBytes(text),config.printerHost,config.printerPort);
      // TCP accept is not printer paper-output confirmation.
      respond(202,{queued:true,printed:false});
    }catch(err){respond(422,{error:err.message||'Không gửi được lệnh.'});}
  };
}
function start(){
  if(!TOKEN||TOKEN.length<32||!PRINTER_HOST||!Number.isInteger(PORT)||PORT<1||PORT>65535)
    throw Error('Thiếu TSH_GATEWAY_TOKEN (>=32 ký tự), TSH_PRINTER_IP hoặc port không hợp lệ.');
  return http.createServer(createHandler({token:TOKEN,printerHost:PRINTER_HOST,printerPort:PRINTER_PORT}))
    .listen(PORT,HOST);
}
if(require.main===module)start();
module.exports={authorized,receiptBytes,createHandler,sendToPrinter,start};
