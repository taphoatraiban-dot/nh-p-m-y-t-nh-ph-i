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
