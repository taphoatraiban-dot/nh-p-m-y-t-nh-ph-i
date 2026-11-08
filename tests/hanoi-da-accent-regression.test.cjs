'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
test('Hanoi accented đa wager is equivalent to da without changing other lines',()=>{
 const raw='hn\n07.70da5.\n01.10da2..26.62.10da2..\n25.52.65da2.\n13.31.57.75.đa1..\n125..165xc10.b2.\n166b3.\n475..457..113..531b2.\n24.67da2.';
 const normalized=raw.replace(/đa(?=\s*\d)/gi,'da');
 const a=parse(raw,'2026-11-08'),b=parse(normalized,'2026-11-08');
 assert.deepEqual(a.errors,b.errors);
 assert.deepEqual(a.rows.map(r=>[r.region,r.type,r.gross,r.points]),b.rows.map(r=>[r.region,r.type,r.gross,r.points]));
});
