const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const net=require('node:net');

test('Mock HTTPS queue -> worker -> ESC/POS TCP printer, không dùng Supabase thật',async()=>{
  const received=[];
  const states=[];
  const tcp=net.createServer(socket=>{
    socket.on('data',part=>received.push(part));
  });
  await new Promise(resolve=>tcp.listen(0,'127.0.0.1',resolve));
  const api=http.createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');
    if(req.method==='GET'){
      res.end(JSON.stringify([{id:73001,print_text:'MA PHIEU: TEST73001\n2dmn\n221bdao1.'}]));
    }else{
      let body='';for await(const part of req)body+=part;
      states.push(JSON.parse(body).status);
      res.end(JSON.stringify([{id:73001}]));
    }
  });
  await new Promise(resolve=>api.listen(0,'127.0.0.1',resolve));
  process.env.TSH_SUPABASE_URL='http://127.0.0.1:'+api.address().port;
  process.env.TSH_SUPABASE_SERVICE_ROLE_KEY='LOCAL_FAKE_SECRET_NOT_REAL_DO_NOT_USE_PRODUCTION';
  process.env.TSH_PRINT_USER_ID='00000000-0000-4000-8000-000000000001';
  process.env.TSH_PRINTER_IP='127.0.0.1';
  process.env.TSH_PRINTER_PORT=String(tcp.address().port);
  process.env.TSH_PRINT_ARMED='YES';
  const {pollOnce}=require('../scripts/mac-one-tap/worker.cjs');
  try{
    await pollOnce();
    assert.deepEqual(states,['processing','sent']);
    assert.ok(Buffer.concat(received).includes(Buffer.from('CUNCUN:PHIEU:TEST73001')));
  }finally{
    await new Promise(resolve=>api.close(resolve));
    await new Promise(resolve=>tcp.close(resolve));
  }
});
