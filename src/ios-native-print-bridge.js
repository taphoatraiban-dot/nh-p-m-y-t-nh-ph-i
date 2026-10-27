/* Bridge only works inside the dedicated iOS companion WKWebView.
   Ordinary iPhone browsers retain the existing share-sheet path. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TSHNativePrintBridge=api;
})(typeof window!=='undefined'?window:null,function(root){
  'use strict';
  const pending=new Map();
  let counter=0;
  function available(){return !!root?.webkit?.messageHandlers?.tshPrinter?.postMessage;}
  function resolve(id,result){
    const slot=pending.get(id);if(!slot)return false;
    pending.delete(id);clearTimeout(slot.timer);
    if(result?.ok)slot.resolve({sent:true,printed:false,transport:'ios-native'});
    else slot.reject(new Error(String(result?.error||'Không thể gửi lệnh in qua Bluetooth.')));
    return true;
  }
  function send(text,doc){
    if(!available())throw Error('Chỉ hỗ trợ in trực tiếp trong ứng dụng iPhone riêng.');
    if(!root?.TSHIOSSharePhoi)throw Error('Chưa có bộ tạo ảnh phiếu.');
    const image=root.TSHIOSSharePhoi.render(text,doc||(root.document));
    const png=image.toDataURL('image/png');
    if(png.length>2_000_000)throw Error('Ảnh phiếu quá lớn để chuyển tới máy in.');
    const id=++counter;
    return new Promise((resolvePromise,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(Error('Máy in không phản hồi.'));},60000);
      pending.set(id,{resolve:resolvePromise,reject,timer});
      try{root.webkit.messageHandlers.tshPrinter.postMessage({id,png});}
      catch(err){pending.delete(id);clearTimeout(timer);reject(err);}
    });
  }
  return {available,send,resolve};
});
