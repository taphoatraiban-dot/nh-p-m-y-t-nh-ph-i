'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

for(const file of ['telegram-chat/index.ts','telegram-tenant/index.ts','telegram-member-sync/index.ts']){
  test(file+' reads no more than the agreed 24-hour window',()=>{
    const source=fs.readFileSync(path.join(__dirname,'../supabase/functions',file),'utf8');
    assert.match(source,/Date\.now\(\)\s*-\s*24\s*\*\s*3600000/);
    assert.doesNotMatch(source,/Date\.now\(\)\s*-\s*48\s*\*\s*3600000/);
  });
}
