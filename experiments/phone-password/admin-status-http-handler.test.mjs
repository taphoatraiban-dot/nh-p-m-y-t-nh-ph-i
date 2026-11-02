import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminStatusHttpHandler} from './admin-status-http-handler.mjs';
const uid='123e4567-e89b-42d3-a456-426614174000';
test('status endpoint checks real adapter interface and exposes no identity',async()=>{
 const handler=createAdminStatusHttpHandler({
  authClient:{auth:{getUser:async()=>({data:{user:{id:uid,email:'hidden@example.test'}},error:null})}},
  adminDb:{from:()=>({select:()=>({eq:()=>({limit:async()=>({data:[{user_id:uid}],error:null})})})})}
 });
 const r=await handler({method:'GET',url:'/admin/phone/status',headers:{authorization:'Bearer '+ 'a'.repeat(30)}});
 assert.deepEqual(r,{status:200,body:{authenticated:true,admin:true}});
 assert.equal(JSON.stringify(r).includes(uid),false);
 assert.equal((await handler({method:'POST',url:'/admin/phone/status',headers:{}})).status,404);
 assert.equal((await handler({method:'GET',url:'/admin/phone/status',headers:{}})).status,401);
});
