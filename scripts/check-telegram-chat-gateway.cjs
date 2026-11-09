'use strict';
const DEFAULT_URL='https://zigpqddlhvjbjrwhfhaa.supabase.co/functions/v1/telegram-chat';
async function checkGateway(url=DEFAULT_URL,request=fetch){
 // Deliberately invalid credentials: no claim, queue mutation or Telegram message.
 const target=new URL(url);target.searchParams.set('action','ack');
 const response=await request(target,{method:'POST',headers:{'Content-Type':'application/json','x-sync-user':'00000000-0000-4000-8000-000000000000','x-sync-key':'invalid-probe-key-'.repeat(4)},body:'{}',signal:AbortSignal.timeout(25000)});
 let body;try{body=await response.json();}catch{throw Error('Chat gateway returned a non-JSON response');}
 if(response.status!==401||body.error!=='Unauthorized')throw Error('Chat gateway configuration changed: worker requests must reach the handler; invalid sync keys must still be rejected');
 return true;
}
module.exports={checkGateway};
if(require.main===module)checkGateway(process.argv[2]).then(()=>console.log('Chat gateway OK: worker route reachable; invalid credentials rejected')).catch(e=>{console.error(e.message);process.exitCode=1;});
