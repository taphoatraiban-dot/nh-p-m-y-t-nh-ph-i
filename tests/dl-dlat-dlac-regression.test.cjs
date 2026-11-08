'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
for (const [alias,region] of [['dl','N'],['dlat','N'],['dlac','T'],['dlak','T']]) {
  test(alias+' selects correct lottery region and station',()=>{
    const result=parse(alias+'\n52dd6.\n652xc5.','2026-11-08');
    assert.deepEqual(result.errors,[]);
    assert.ok(result.rows.length>0);
    assert.ok(result.rows.every(row=>row.region===region));
  });
}
