import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresAdminGrantsStore} from './postgres-admin-grants-store.mjs';
test('pending query is parameterized and limited',async()=>{
 const calls=[];
 const store=createPostgresAdminGrantsStore({query:async(sql,args)=>{calls.push({sql,args});return {rows:[]}}});
 await store.listPending({limit:25});
 assert.deepEqual(calls[0].args,[25]);
 assert.match(calls[0].sql,/status='pending'/);
 await assert.rejects(()=>store.listPending({limit:1000}),/INVALID_LIMIT/);
});
test('write requires admin and rolls back',async()=>{
 const calls=[];
 const client={query:async(sql,args)=>{calls.push(sql);if(sql.startsWith('select id'))return {rows:[{id:'123e4567-e89b-42d3-a456-426614174000'}]};if(sql.startsWith('select status'))return {rows:[]};return {rows:[]}},release(){}};
 const store=createPostgresAdminGrantsStore({query:async()=>({rows:[]}),connect:async()=>client});
 await assert.rejects(()=>store.applyAction({admin:{id:'guest',role:'user',authenticated:true},accountId:'123e4567-e89b-42d3-a456-426614174000',action:'approve',term:'1m'}),/ADMIN_REQUIRED/);
 assert.ok(calls.includes('rollback'));
 assert.equal(calls.some(s=>s.startsWith('insert into')),false);
});
test('authorized action commits one grant',async()=>{
 const calls=[];
 const client={query:async(sql,args)=>{calls.push(sql);if(sql.startsWith('select id'))return {rows:[{id:'123e4567-e89b-42d3-a456-426614174000'}]};if(sql.startsWith('select status'))return {rows:[]};if(sql.startsWith('insert into'))return {rows:[{status:'approved'}]};return {rows:[]}},release(){}};
 const store=createPostgresAdminGrantsStore({query:async()=>({rows:[]}),connect:async()=>client});
 const r=await store.applyAction({admin:{id:'owner',role:'owner',authenticated:true},accountId:'123e4567-e89b-42d3-a456-426614174000',action:'approve',term:'1m'});
 assert.equal(r.status,'approved');
 assert.ok(calls.includes('commit'));
});
