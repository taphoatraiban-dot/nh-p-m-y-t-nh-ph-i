'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');

// Explicit station aliases must remain valid with a complete wager.
for(const [alias,date] of [['ct','2026-10-28'],['ctho','2026-10-28'],['st','2026-10-28'],['strang','2026-10-28']]){
  test('station alias '+alias+' accepts complete wager',()=>{
    const result=parse(alias+'\n78b5.',date);
    assert.deepEqual(result.errors,[]);
    assert.equal(result.rows.length,1);
  });
}
// A bare number is not a bet: never guess the missing type/stake.
test('bare number 77 must not become a paid wager',()=>{
  const result=parse('ct\n77\nstrang\n78b5.','2026-10-28');
  assert.ok(result.errors.length>0 || !result.rows.some(r=>(r.numbers||[]).includes('77')));
});

test('Wednesday 28 October 2026 is valid for Soc Trang, Thursday is not',()=>{
  const wed=parse('st\n76dd10.','2026-10-28');
  assert.deepEqual(wed.errors,[]);
  const thu=parse('st\n76dd10.','2026-10-29');
  assert.ok(thu.errors.some(e=>/lịch|T4|T5/i.test(String(e))));
});
test('attached Soc Trang and Can Tho headers keep wagers on Wednesday',()=>{
  const r=parse('Soc Trang.58 dau30\n59 dau30\nCt20dd20','2026-10-28');
  assert.deepEqual(r.errors,[]);
  assert.ok(r.rows.length>=3);
});
