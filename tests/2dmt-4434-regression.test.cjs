'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
const raw="2dmt\n5389.3589.6689.b3n,389.589,689b2n.xc5n 5974.7974.6879.7689.8789b3n,974.879.689.789,674b2n.xc15n\n2dmt\n89.74.da5n.dd10n.\n74.dd50n\n2dmt\n26,66da2n.dd10n,6626.6666,6026b1n,626.026,666b1n.xc10n\n2dmt\n6033.6933,3333b1n,033.933,333b1n.xc10n.33dd20n\n2dmt\n6336 bdao1n,636.336 bdao1n xdao10n,3936b1n,936b1n.xc10n.36b10n.dd20n";
test('2DMT reference phoi gross must equal 4434k, 60 rows, no errors',()=>{
 const {rows,errors}=parse(raw,'2026-11-06');
 assert.deepEqual(errors,[]);
 assert.equal(rows.length,60);
 assert.equal(rows.reduce((sum,r)=>sum+Number(r.gross||0),0),4434);
 for(const number of ['636','336'])assert.ok(rows.some(r=>r.numbers.includes(number)&&r.type==='DAO BL'&&r.gross===102),number+' must be DAO BL 102k');
});
