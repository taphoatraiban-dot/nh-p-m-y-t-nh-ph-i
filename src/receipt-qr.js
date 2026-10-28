/* Optional QR receipt workflow; no changes to existing printer paths.
 * Requires a stored print_queue job ID. API must be deployed and configured first.
 * Use from an authenticated, explicit QR-print action, not from automatic queue processing.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CuncunReceiptQR=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const endpoint='https://zigpqddlhvjbjrwhfhaa.supabase.co/functions/v1/receipt-verify';
  const verifyBase='https://cuncun.icu/verify.html';
  function validateToken(token){
    if(!/^[a-f0-9]{64}$/.test(String(token||'')))throw Error('Mã xác thực không hợp lệ.');
    return token;
  }
  async function issue(printQueueId,accessToken){
    if(!Number.isSafeInteger(Number(printQueueId))||Number(printQueueId)<1)throw Error('Mã hàng đợi không hợp lệ.');
    if(!accessToken)throw Error('Cần đăng nhập để phát hành QR.');
    const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+accessToken},body:JSON.stringify({action:'issue',print_queue_id:Number(printQueueId)})});
    const data=await r.json();
    if(!r.ok)throw Error(data.error||'Không phát hành được QR.');
    validateToken(data.token);
    return {code:data.receipt_code,token:data.token,url:verifyBase+'?token='+encodeURIComponent(data.token)};
  }
  async function matrix(url){
    if(!url.startsWith(verifyBase+'?token='))throw Error('URL xác thực không hợp lệ.');
    // Pinned QR encoder; only load when user explicitly prints a QR receipt.
    const qr=await import('https://esm.sh/qrcode@1.5.4?bundle');
    const create=qr.create||(qr.default&&qr.default.create);
    if(typeof create!=='function')throw Error('Không tải được bộ mã hóa QR.');
    const generated=create(url,{errorCorrectionLevel:'M'});
    const n=generated.modules.size;
    if(n<21||n>177)throw Error('Kích thước QR không được hỗ trợ.');
    return Array.from({length:n},(_,y)=>Array.from({length:n},(_,x)=>generated.modules.get(x,y)?1:0));
  }
  async function makeTableReceipt(receipt,printQueueId,accessToken){
    const issued=await issue(printQueueId,accessToken);
    const qrMatrix=await matrix(issued.url);
    return {receipt:'[[TABLE80]]'+JSON.stringify({...receipt,code:issued.code,qrMatrix}),code:issued.code,url:issued.url};
  }
  return {issue,matrix,makeTableReceipt,validateToken};
});
