'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('./helpers/production-parser.cjs');
const date='2026-11-14';
function equivalent(raw,canonical,label){
 test(label,()=>{
  const actual=parse(raw,date),expected=parse(canonical,date);
  assert.deepEqual(actual.errors,expected.errors,'error mismatch');
  assert.deepEqual(actual.rows,expected.rows,'wager rows mismatch');
  assert.ok(expected.rows.length>0,'canonical wager not parsed');
 });
}
for(const header of ['2dmn','3dmn','2dmt','3dmt','hn']){
 for(const stake of ['1n','2n','0,5n']){
  equivalent(header+'\n4955d'+stake+'.',header+'\n4955da'+stake+'.',header+' short d '+stake);
  equivalent(header+'\n4955₫'+stake+'.',header+'\n4955da'+stake+'.',header+' dong short '+stake);
 }
}
equivalent('3dmn\n4400₫a1.','3dmn\n4400da1.','dong-a da');
equivalent('2₫mn\n068xc20n.','2dmn\n068xc20n.','dong in 2dmn header');
equivalent('3₫mt\n049xc15n.','3dmt\n049xc15n.','dong in 3dmt header');
equivalent(
 '3dmn .4400₫a1.\n2₫mn 068xc20n\n3₫mt 049xc15n\n4955₫1n\nHn .049b2ngxc25n\n4955₫2n\n055xc20n\n347xc15n',
 '3dmn\n4400da1.\n2dmn\n068xc20n.\n3dmt\n049xc15n.\n4955da1n.\nhn\n049b2n.xc25n.\n4955da2n.\n055xc20n.\n347xc15n.',
 'full customer slip preserves all wagers');
