import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const edge=fs.readFileSync(new URL('../supabase/functions/receipt-verify/index.ts',import.meta.url),'utf8');
const cross=(first,second,otherA,otherB)=>Math.min(first+otherA,second+otherB);
test('QR server aggregates DA numbers from both stations before pairing',()=>{
 assert.match(edge,/Math\.min\(first\+otherA,second\+otherB\)/);
 assert.match(edge,/Math\.min\(first,second\)/);
 assert.doesNotMatch(edge,/Math\.min\(first,otherB\)\+Math\.min\(second,otherA\)/);
});
test('16 Nov 2026 HCM and Dong Thap: 65 twice and 67 twice pays 2 DA',()=>{
 // HCM 65x1 67x2; Dong Thap 65x1 67x0.
 assert.equal(cross(1,2,1,0),2);
 assert.equal(cross(1,2,1,0)*540,1080);
});
test('one unmatched extra number cannot increase DA payout',()=>{
 assert.equal(cross(1,2,0,0),1);
 assert.equal(cross(2,3,0,0),2);
 assert.equal(cross(0,0,0,2),0);
});
test('three distinct DA numbers pay 3 pairs, repeated all three pay 6',()=>{
 const pairTotal=counts=>Math.min(counts[0],counts[1])+Math.min(counts[0],counts[2])+Math.min(counts[1],counts[2]);
 assert.equal(pairTotal([1,1,1])*540,1620);
 assert.equal(pairTotal([2,2,2])*540,3240);
 assert.equal(pairTotal([2,2,1])*540,2160);
});
test('same-station results also count when two-station group is selected',()=>{
 assert.equal(cross(1,1,0,0),1);
 assert.equal(cross(0,0,2,2),2);
});
