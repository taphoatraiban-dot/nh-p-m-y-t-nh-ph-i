/* Zalo personal manual import — opt-in staging module; no Zalo API, storage or network. */
(function(global){
 'use strict';
 function mount(options){
  options=options||{};
  const doc=options.document||global.document;
  const host=typeof options.host==='string'?doc.querySelector(options.host):options.host;
  if(!host)throw new Error('Cần xác định vị trí gắn giao diện');
  if(host.querySelector('[data-zalo-manual]'))return host.querySelector('[data-zalo-manual]');
  const root=doc.createElement('section');root.dataset.zaloManual='true';
  root.style.cssText='border:1px solid #d7e3f4;border-radius:14px;padding:12px;margin:10px 0;background:#fff;color:#17212f;box-shadow:0 2px 12px rgba(20,55,100,.06);max-width:100%;box-sizing:border-box';
  const title=doc.createElement('details');const summary=doc.createElement('summary');
  summary.textContent='💬 Zalo cá nhân · Dán tin thủ công';summary.style.cssText='cursor:pointer;font:600 16px system-ui;color:#0866c9;padding:6px 2px;min-height:34px';title.append(summary);
  const note=doc.createElement('p');note.textContent='Sao chép tin từ Zalo → Dán → Xem trước → Xác nhận → Đưa vào ô phơi. Không kết nối tài khoản Zalo.';note.style.cssText='font:13px/1.5 system-ui;color:#526579;margin:10px 0';
  const field=doc.createElement('textarea');field.rows=5;field.maxLength=12000;
  field.placeholder='Sao chép nội dung trong Zalo rồi dán vào đây';field.setAttribute('aria-label','Nội dung Zalo sao chép');
  field.style.cssText='box-sizing:border-box;width:100%;font:16px/1.5 system-ui;padding:12px;border:1px solid #b8c9de;border-radius:12px;background:#f7faff;color:#17212f;resize:vertical';
  const preview=doc.createElement('pre');preview.hidden=true;preview.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;padding:12px;border-radius:12px;background:#e8f4ff;border:1px solid #c8e5ff;font:15px/1.5 system-ui';
  const paste=doc.createElement('button');paste.type='button';paste.textContent='Dán từ bộ nhớ tạm';
  paste.style.cssText='min-height:44px;padding:10px 14px;margin:8px 8px 8px 0;border-radius:8px;cursor:pointer';
  const review=doc.createElement('button');review.type='button';review.textContent='Xem trước';review.style.cssText='min-height:44px;padding:10px 14px;margin:8px 8px 8px 0;border-radius:8px;cursor:pointer';
  const consent=doc.createElement('label');consent.style.cssText='display:block;margin:8px 0';
  const check=doc.createElement('input');check.type='checkbox';check.disabled=true;
  const reminder=doc.createElement('p');reminder.textContent='Bảng giá và khách hàng phải được kiểm tra trên giao diện CUNCUN trước khi bấm xác nhận. Không tự chọn bảng giá.';reminder.style.cssText='font-size:13px;color:#475569;margin:8px 0';
  consent.append(check,doc.createTextNode(' Tôi đã kiểm tra nội dung và đúng bảng giá trên CUNCUN'));
  const transfer=doc.createElement('button');transfer.type='button';transfer.textContent='Đưa vào ô nhập phơi';transfer.disabled=true;transfer.style.cssText='min-height:44px;padding:10px 14px;border-radius:10px;cursor:pointer;background:#0878d9;color:white;border:0;font-weight:600';
  const clear=doc.createElement('button');clear.type='button';clear.textContent='Xóa nội dung dán';
  clear.style.cssText='min-height:44px;padding:10px 14px;margin:8px;border-radius:8px;cursor:pointer';
  const status=doc.createElement('p');status.style.cssText='font:13px/1.5 system-ui;color:#475569;margin:8px 0';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  let clipboardGeneration=0;
  const reset=()=>{preview.hidden=true;preview.textContent='';check.checked=false;check.disabled=true;transfer.disabled=true};
  const isUnlocked=()=>Boolean(doc.body?.classList?.contains('app-unlocked'));
  const clearOnLock=()=>{
   if(isUnlocked())return;
   clipboardGeneration++;
   field.value='';reset();title.open=false;
   status.textContent='CUNCUN đã khóa. Nội dung Zalo tạm thời đã được xóa để bảo vệ riêng tư.';
  };
  if(typeof global.MutationObserver==='function'&&doc.body){
   const observer=new global.MutationObserver(clearOnLock);
   observer.observe(doc.body,{attributes:true,attributeFilter:['class']});
  }
  field.addEventListener('input',()=>{clipboardGeneration++;reset();if(!isUnlocked())clearOnLock();});
  paste.addEventListener('click',async()=>{
   if(!isUnlocked()){clearOnLock();return;}
   const generation=++clipboardGeneration;
   reset();
   if(!global.navigator?.clipboard?.readText){
    status.textContent='Trình duyệt không hỗ trợ dán tự động. Hãy chạm giữ ô nhập và chọn Dán.';field.focus();return;
   }
   const before=field.value;
   try{
    const text=await global.navigator.clipboard.readText();
    if(!isUnlocked()){clearOnLock();return;}
    if(generation!==clipboardGeneration||field.value!==before){status.textContent='Nội dung đã thay đổi trong lúc đọc bộ nhớ tạm. Không ghi đè thao tác mới.';return;}
    if(!text){status.textContent='Bộ nhớ tạm không có nội dung chữ.';return}
    if(text.length>field.maxLength){
     status.textContent='Tin quá dài (trên 12.000 ký tự). Hãy chia thành nhiều lần dán để tránh mất nội dung.';return;
    }
    field.value=text;reset();status.textContent='Đã dán nội dung. Hãy bấm Xem trước và kiểm tra bảng giá trước khi chuyển.';field.focus();
   }catch(err){if(generation!==clipboardGeneration)return;status.textContent='Không đọc được bộ nhớ tạm. Hãy chạm giữ ô nhập và chọn Dán.';field.focus();}
  });
  clear.addEventListener('click',()=>{
   if(!field.value&&!preview.textContent)return;
   if(!global.confirm('Xóa nội dung đang dán từ Zalo? Ô nhập phơi CUNCUN sẽ không bị thay đổi.'))return;
   clipboardGeneration++;field.value='';reset();status.textContent='Đã xóa nội dung dán Zalo. Ô nhập phơi vẫn giữ nguyên.';
  });
  review.addEventListener('click',()=>{
   if(!isUnlocked()){clearOnLock();return;}
   reset();const value=field.value.trim();
   if(!value){status.textContent='Hãy dán nội dung trước';return}
   preview.textContent=value;preview.hidden=false;check.disabled=false;
   status.textContent='Kiểm tra nội dung và bảng giá đang chọn trong CUNCUN trước khi xác nhận';
  });
  check.addEventListener('change',()=>{if(!isUnlocked()){clearOnLock();return;}transfer.disabled=!check.checked||preview.hidden});
  transfer.addEventListener('click',()=>{
   if(transfer.disabled||preview.hidden||!check.checked)return;
   const bets=doc.getElementById('bets');
   if(!bets||!('value' in bets)){status.textContent='Không tìm thấy ô nhập phơi CUNCUN';return}
   const value=preview.textContent;if(!value)return;
   // A programmatic edit may bypass the input event; reject stale review text.
   if(field.value.trim()!==value){reset();status.textContent='Nội dung đã thay đổi, hãy xem trước và xác nhận lại';return}
   // Reject imports if the application is locked, even when the panel remains in the DOM.
   if(!isUnlocked()){
    status.textContent='CUNCUN đang khóa. Hãy mở khóa phần mềm trước khi nhập phơi.';return;
   }
   const existing=bets.value.trim();
   if(existing&&!global.confirm('Ô nhập đã có nội dung. Chọn OK để nối thêm tin Zalo; Hủy để giữ nguyên.'))return;
   // A native confirmation can outlive a session lock; revalidate before writing.
   if(!isUnlocked()){clearOnLock();return;}
   if(field.value.trim()!==value||preview.hidden||!check.checked){reset();status.textContent='Nội dung đã thay đổi. Hãy xác nhận lại.';return;}
   bets.value=(existing?bets.value.replace(/\s*$/,'')+'\n':'')+value;
   // Match the existing Telegram manual-import event contract so calculator listeners
   // can distinguish a user-confirmed chat paste from ordinary typing.
   bets.dispatchEvent(new global.CustomEvent('input',{bubbles:true,detail:{ottChatManualImport:true,zaloManualImport:true}}));
   bets.dispatchEvent(new global.Event('change',{bubbles:true}));
   clipboardGeneration++;reset();field.value='';title.open=false;bets.focus();if(typeof bets.scrollIntoView==='function')bets.scrollIntoView({behavior:'smooth',block:'center'});
   status.textContent='Đã chuyển vào ô nhập. Hãy kiểm tra kết quả trước khi bấm OK; chưa lưu hoặc in.';
  });
  for(const el of [note,field,paste,review,clear,preview,reminder,consent,transfer,status])title.append(el);
  root.append(title);host.append(root);return root;
 }
 global.CuncunZaloManualImport=Object.freeze({mount});
})(window);
