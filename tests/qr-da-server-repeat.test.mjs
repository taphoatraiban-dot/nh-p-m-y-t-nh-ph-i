import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const edge=fs.readFileSync(new URL('../supabase/functions/receipt-verify/index.ts',import.meta.url),'utf8');
test('QR server diagnostic counts DA repetitions instead of boolean wins',()=>{
 assert.match(edge,/Math\.min\(first,otherB\)\+Math\.min\(second,otherA\)/);
 assert.match(edge,/Math\.min\(first,second\)/);
 assert.doesNotMatch(edge,/One distinct pair pays once, regardless of duplicate prize occurrences/);
});
test('DA cross counts matched repeats, not unmatched extras',()=>{
 const times=(first,second,otherA,otherB)=>Math.min(first,otherB)+Math.min(second,otherA);
 assert.equal(times(2,0,0,2),2);
 assert.equal(times(3,0,0,1),1);
 assert.equal(times(0,0,2,2),0);
 assert.equal(times(1,1,1,1),2);
});
