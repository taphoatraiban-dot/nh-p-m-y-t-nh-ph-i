/* Direct printing is available only inside the separately installed Cucun iOS app.
   A successful transport write does not prove paper output. */
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
    const slot=pending.get(id);
    if(!slot)return false;
    pending.delete(id);
    clearTimeout(slot.timer);
    if(result?.ok)slot.resolve({sent:true,printed:false,transport:'ios-native'});
    else slot.reject(new Error(String(result?.error||'Không gửi được dữ liệu đến máy in.')));
    return true;
  }
  function send(text,doc){
    if(!available())throw Error('Cần mở trong ứng dụng Cucun Printer trên iPhone.');
    if(!root?.TSHIOSSharePhoi)throw Error('Chưa tải được mẫu phiếu in.');
    const png=root.TSHIOSSharePhoi.render(text,doc||root.document).toDataURL('image/png');
    if(png.length>2_000_000)throw Error('Phiếu quá dài để in trực tiếp.');
    const id=++counter;
    return new Promise((resolvePromise,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(Error('Không có phản hồi từ ứng dụng máy in.'));},60000);
      pending.set(id,{resolve:resolvePromise,reject,timer});
      try{root.webkit.messageHandlers.tshPrinter.postMessage({id,png});}
      catch(err){pending.delete(id);clearTimeout(timer);reject(err);}
    });
  }
  return {available,send,resolve};
});
