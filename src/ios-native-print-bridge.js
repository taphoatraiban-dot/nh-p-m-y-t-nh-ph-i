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
  function send(text,doc,connectionMode){
    if(!available())throw Error('Cần mở trong ứng dụng Cucun Printer trên iPhone.');
    if(!root?.TSHIOSSharePhoi)throw Error('Chưa tải được mẫu phiếu in.');
    const png=root.TSHIOSSharePhoi.render(text,doc||root.document).toDataURL('image/png');
    if(png.length>2_000_000)throw Error('Phiếu quá dài để in trực tiếp.');
    const mode=connectionMode==='wifi'||connectionMode==='bluetooth'?connectionMode:null;
    const id=++counter;
    return new Promise((resolvePromise,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(Error('Không có phản hồi từ ứng dụng máy in.'));},60000);
      pending.set(id,{resolve:resolvePromise,reject,timer});
      try{root.webkit.messageHandlers.tshPrinter.postMessage(mode?{id,png,mode,connectionMode:mode}:{id,png});}
      catch(err){pending.delete(id);clearTimeout(timer);reject(err);}
    });
  }
  function installDDAlias(doc,box){
    if(box.dataset.ottDDAliasInstalled)return;
    box.dataset.ottDDAliasInstalled='1';
    const normalize=()=>{
      const before=box.value;
      const after=before.replace(/đd/gi,'dd');
      if(after===before)return;
      const start=Number.isInteger(box.selectionStart)?box.selectionStart:before.length;
      const end=Number.isInteger(box.selectionEnd)?box.selectionEnd:start;
      const nextStart=before.slice(0,start).replace(/đd/gi,'dd').length;
      const nextEnd=before.slice(0,end).replace(/đd/gi,'dd').length;
      box.value=after;
      if(typeof box.setSelectionRange==='function')box.setSelectionRange(nextStart,nextEnd);
      box.dispatchEvent(new doc.defaultView.Event('input',{bubbles:true}));
    };
    box.addEventListener('input',normalize);
    if(box.value.includes('đd'))normalize();
  }
  function installClipboardPasteButton(doc){
    const mount=()=>{
      const box=doc.getElementById('bets');
      if(!box)return false;
      installDDAlias(doc,box);
      if(doc.querySelector('[aria-label="Dán nhiều tin từ clipboard"]'))return true;
      const tools=doc.createElement('div');
      tools.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0';
      const button=doc.createElement('button');
      button.type='button';button.textContent='Dán nhiều tin';
      button.setAttribute('aria-label','Dán nhiều tin từ clipboard');
      button.title='Chép các tin trong Telegram, sau đó chạm nút này.';
      const message=doc.createElement('span');
      message.setAttribute('role','status');message.setAttribute('aria-live','polite');
      message.style.cssText='font-size:13px';
      tools.append(button,message);box.insertAdjacentElement('afterend',tools);
      button.addEventListener('click',async()=>{
        button.disabled=true;message.textContent='Đang đọc clipboard…';
        try{
          const clip=doc.defaultView.navigator.clipboard;
          let parts=[];
          if(clip?.read){
            const items=await clip.read();
            for(const item of items){
              if(item.types?.includes('text/plain'))parts.push(await (await item.getType('text/plain')).text());
            }
          }
          let text=parts.filter(Boolean).join('\\n');
          if(!text&&clip?.readText)text=await clip.readText();
          if(!text){message.textContent='Clipboard không có văn bản. Hãy chép lại tin trong Telegram.';return;}
          const start=Number.isInteger(box.selectionStart)?box.selectionStart:box.value.length;
          const end=Number.isInteger(box.selectionEnd)?box.selectionEnd:box.value.length;
          if(typeof box.setRangeText==='function')box.setRangeText(text.replace(/\\r\\n?/g,'\\n'),start,end,'end');
          else box.value=box.value.slice(0,start)+text+box.value.slice(end);
          const EventCtor=doc.defaultView.Event;
          box.dispatchEvent(new EventCtor('input',{bubbles:true}));
          box.dispatchEvent(new EventCtor('change',{bubbles:true}));
          box.focus();message.textContent=parts.filter(Boolean).length>1?'Đã ghép '+parts.filter(Boolean).length+' mục clipboard thành nhiều dòng.':'Đã dán nội dung clipboard.';
        }catch{
          message.textContent='iPhone chưa cho phép đọc clipboard. Chạm giữ ô nhập rồi chọn “Dán”.';
        }finally{button.disabled=false;}
      });
      return true;
    };
    if(mount())return;
    if(doc.documentElement&&typeof MutationObserver==='function'){
      const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
      observer.observe(doc.documentElement,{childList:true,subtree:true});
    }
  }
  if(root?.document)installClipboardPasteButton(root.document);
  return {available,send,resolve};
});
