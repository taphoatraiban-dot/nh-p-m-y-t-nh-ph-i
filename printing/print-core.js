/* CUNCUN printing rebuild: independent state and duplicate-click guard.
   This module does not claim a receipt was printed when a share dialog opens. */
(function(global){
  'use strict';
  const ACTIVE = new Set();
  const STATES = Object.freeze({SENDING:'sending',QUEUED:'queued',PRINTING:'printing',PRINTED:'printed',FAILED:'failed',SHARED:'shared'});
  function createJobId(){
    if(global.crypto && typeof global.crypto.randomUUID==='function') return global.crypto.randomUUID();
    throw new Error('Secure job IDs require crypto.randomUUID');
  }
  function lock(key){
    if(!key || ACTIVE.has(key)) return false;
    ACTIVE.add(key);
    return true;
  }
  function unlock(key){ ACTIVE.delete(key); }
  function normalizeState(value){
    const v=String(value||'').toLowerCase();
    if(v==='pending') return STATES.QUEUED;
    if(v==='claimed'||v==='processing') return STATES.PRINTING;
    if(v==='completed') return STATES.PRINTED;
    if(v==='error') return STATES.FAILED;
    return Object.values(STATES).includes(v)?v:null;
  }
  function displayState(value){
    const s=normalizeState(value);
    return ({sending:'Đang gửi phiếu',queued:'Đã vào hàng đợi',printing:'Mac Mini đang xử lý',printed:'Worker báo đã in',failed:'In thất bại',shared:'Đã mở chia sẻ; chưa xác nhận in'})[s]||'Chưa xác minh trạng thái';
  }
  global.CuncunPrintCore=Object.freeze({STATES,createJobId,lock,unlock,normalizeState,displayState});
})(window);
