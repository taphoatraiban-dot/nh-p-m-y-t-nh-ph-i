'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
const raw=`2dmt
69.96da2.
19.91.39.93da1.
Glai
09b100.
91b25.
90b30.
2dmt
33 .99 .13da2.
2dmt
89.74da2.
74.dd20.
Glai
64b10.
2dmt
6336 bdao1.,
636.336 bdao1.xdao10.,
3936b1.
936xc13.
36dd10.
Nthuan
36b10.
2dmt
888b3.xc10.
Nthuan
44b10.`;
test('multiple repeated station blocks: gross 5464k without ghost DAO XC',()=>{
 const {rows,errors}=parse(raw,'2026-11-06');
 assert.deepEqual(errors,[]);
 assert.equal(rows.reduce((s,r)=>s+r.gross,0),5464);
 assert.equal(rows.filter(r=>r.station==='Gia Lai'&&r.type==='DAO XC').length,0);
 assert.equal(rows.filter(r=>r.station==='2 Đài MT'&&r.type==='DAO XC').reduce((s,r)=>s+r.gross,0),240);
 assert.equal(rows.length,21);
});
