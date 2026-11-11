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
  const title=doc.createElement('details');title.open=false;const summary=doc.createElement('summary');
  summary.textContent='💬 Zalo cá nhân · Nhập tin';summary.style.cssText='cursor:pointer;font:600 16px system-ui;color:#0866c9;padding:6px 2px;min-height:34px';title.append(summary);
  const note=doc.createElement('p');note.textContent='Nhập hoặc sao chép tin từ Zalo → Xem trước → Xác nhận → Đưa vào ô phơi. Đây là nhập thủ công, không đồng bộ tài khoản Zalo.';note.style.cssText='font:13px/1.5 system-ui;color:#526579;margin:10px 0';
  const field=doc.createElement('textarea');field.rows=5;field.maxLength=12000;
  field.placeholder='Nhập tin hoặc sao chép từ Zalo rồi dán vào đây…';field.setAttribute('aria-label','Nội dung Zalo nhập thủ công');field.setAttribute('autocomplete','off');field.setAttribute('autocorrect','off');field.setAttribute('autocapitalize','off');field.setAttribute('spellcheck','false');
  field.style.cssText='box-sizing:border-box;width:100%;font:16px/1.5 system-ui;padding:12px;border:1px solid #b8c9de;border-radius:12px;background:#f7faff;color:#17212f;resize:vertical';
  // A chat-like composition area without pretending to sync real Zalo conversations.
  const composer=doc.createElement('div');composer.style.cssText='border:1px solid #d6e5f4;border-radius:14px;background:#f1f6fc;padding:10px;margin:10px 0';
  const composerLabel=doc.createElement('p');composerLabel.textContent='TIN NHẮN NHẬP THỦ CÔNG';composerLabel.style.cssText='font:600 11px system-ui;letter-spacing:.5px;color:#64748b;margin:0 0 8px';
  composer.append(composerLabel,field);
  const previewLabel=doc.createElement('p');previewLabel.textContent='XEM TRƯỚC TIN NHẮN';previewLabel.style.cssText='font:600 11px system-ui;letter-spacing:.5px;color:#64748b;margin:12px 0 6px';
    const counter=doc.createElement('p');counter.style.cssText='font:12px system-ui;color:#64748b;text-align:right;margin:4px 0 8px';counter.textContent='0 / 12.000 ký tự';
  const updateCounter=()=>{counter.textContent=field.value.length.toLocaleString('vi-VN')+' / 12.000 ký tự'};
    const preview=doc.createElement('pre');preview.hidden=true;preview.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;padding:12px 14px;border-radius:16px 16px 4px 16px;background:#d9f2e3;border:1px solid #b4dec4;font:15px/1.5 system-ui;color:#153b2b;max-width:90%;margin:8px 0 8px auto;box-sizing:border-box';preview.setAttribute('aria-label','Bong bóng xem trước tin Zalo nhập thủ công');
  const paste=doc.createElement('button');paste.type='button';paste.textContent='Dán từ bộ nhớ tạm';
  paste.style.cssText='min-height:44px;padding:10px 14px;margin:8px 8px 8px 0;border-radius:8px;cursor:pointer';
  const appendPaste=doc.createElement('button');appendPaste.type='button';appendPaste.textContent='Nối tin đã sao chép';appendPaste.style.cssText='min-height:44px;padding:10px 14px;margin:8px 8px 8px 0;border-radius:8px;cursor:pointer';
  const review=doc.createElement('button');review.type='button';review.textContent='Xem trước';review.style.cssText='min-height:44px;padding:10px 14px;margin:8px 8px 8px 0;border-radius:8px;cursor:pointer';
  const consent=doc.createElement('label');consent.style.cssText='display:block;margin:8px 0';
  const check=doc.createElement('input');check.type='checkbox';check.disabled=true;
  const reminder=doc.createElement('p');reminder.textContent='Bảng giá và khách hàng phải được kiểm tra trên giao diện CUNCUN trước khi bấm xác nhận. Không tự chọn bảng giá.';reminder.style.cssText='font-size:13px;color:#475569;margin:8px 0';
  consent.append(check,doc.createTextNode(' Tôi đã kiểm tra nội dung và đúng bảng giá trên CUNCUN'));
  const transfer=doc.createElement('button');transfer.type='button';transfer.textContent='Đưa vào ô nhập phơi';transfer.disabled=true;transfer.style.cssText='min-height:44px;padding:10px 14px;border-radius:10px;cursor:pointer;background:#0878d9;color:white;border:0;font-weight:600';
  const clear=doc.createElement('button');clear.type='button';clear.textContent='Xóa nội dung dán';
  clear.style.cssText='min-height:44px;padding:10px 14px;margin:8px;border-radius:8px;cursor:pointer';
  // Keep all actions reachable on narrow iPhone and Android screens.
  const actions=doc.createElement('div');
  actions.style.cssText='display:flex;flex-wrap:wrap;gap:8px;align-items:stretch;margin:8px 0';
  for(const button of [paste,appendPaste,review,clear]){
   button.style.cssText+=';flex:1 1 135px;margin:0;min-width:0;white-space:normal';
  }
  actions.append(paste,appendPaste,review,clear);
  const transferArea=doc.createElement('div');
  transferArea.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:10px 0';
  transfer.style.cssText+=';flex:1 1 180px;min-width:0;white-space:normal';
  transferArea.append(transfer);
    const status=doc.createElement('p');status.style.cssText='font:13px/1.5 system-ui;color:#475569;margin:8px 0';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  let clipboardGeneration=0;
  previewLabel.hidden=true;
  const reset=()=>{preview.hidden=true;previewLabel.hidden=true;preview.textContent='';check.checked=false;check.disabled=true;transfer.disabled=true};
  const isUnlocked=()=>Boolean(doc.body?.classList?.contains('app-unlocked'));
  const clearOnLock=()=>{
   if(isUnlocked())return;
   clipboardGeneration++;
   field.value='';updateCounter();reset();title.open=false;
   status.textContent='CUNCUN đã khóa. Nội dung Zalo tạm thời đã được xóa để bảo vệ riêng tư.';
  };
  if(typeof global.MutationObserver==='function'&&doc.body){
   const observer=new global.MutationObserver(()=>{
    if(isUnlocked()){
     // Unlock restores the visible composer, never the cleared private draft.
     // Keep the panel collapsed until the operator explicitly opens it.
    }else clearOnLock();
   });
   observer.observe(doc.body,{attributes:true,attributeFilter:['class']});
  }
  field.addEventListener('input',()=>{clipboardGeneration++;reset();updateCounter();if(!isUnlocked())clearOnLock();});
  // When switching away and returning on mobile, require a fresh review before transfer.
  if(typeof doc.addEventListener==='function'){
   doc.addEventListener('visibilitychange',()=>{
    if(doc.visibilityState==='hidden'){
     clipboardGeneration++;reset();
     status.textContent='Đã tạm khóa xác nhận. Hãy xem trước lại nội dung khi quay về CUNCUN.';
    }
   });
  }
  field.addEventListener('keydown',event=>{
   // Chat-like shortcut on desktop; Enter alone remains a newline for multiline phoi.
   if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){
    event.preventDefault();review.click();
   }
  });
  // Treat leaving the page as a privacy boundary; never retain a Zalo draft across navigation.
  if(typeof global.addEventListener==='function'){
   global.addEventListener('pagehide',()=>{
    clipboardGeneration++;field.value='';updateCounter();reset();title.open=false;
   });
  }
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
    if(generation!==clipboardGeneration)return;
    if(field.value!==before){status.textContent='Nội dung đã thay đổi trong lúc đọc bộ nhớ tạm. Không ghi đè thao tác mới.';return;}
    if(!text){status.textContent='Bộ nhớ tạm không có nội dung chữ.';return}
    if(text.length>field.maxLength){
     status.textContent='Tin quá dài (trên 12.000 ký tự). Hãy chia thành nhiều lần dán để tránh mất nội dung.';return;
    }
    if(before.trim()&&before!==text){
     if(!global.confirm('Ô Zalo đang có tin chưa chuyển. Chọn OK để thay bằng nội dung vừa sao chép; Hủy để giữ tin đang soạn.')){
      status.textContent='Đã giữ nguyên tin Zalo đang soạn.';return;
     }
     // Confirmation may span a lock, a background transition, or a newer edit.
     if(!isUnlocked()){clearOnLock();return;}
     if(generation!==clipboardGeneration||field.value!==before){status.textContent='Nội dung đã thay đổi trong lúc xác nhận. Không ghi đè tin mới.';return;}
    }
    field.value=text;updateCounter();reset();status.textContent='Đã dán nội dung. Hãy bấm Xem trước và kiểm tra bảng giá trước khi chuyển.';field.focus();
   }catch(err){if(generation!==clipboardGeneration)return;status.textContent='Không đọc được bộ nhớ tạm. Hãy chạm giữ ô nhập và chọn Dán.';field.focus();}
  });
  appendPaste.addEventListener('click',async()=>{
   if(!isUnlocked()){clearOnLock();return;}
   const generation=++clipboardGeneration;
   reset();
   if(!global.navigator?.clipboard?.readText){status.textContent='Không đọc được bộ nhớ tạm. Hãy dán thủ công vào ô Zalo.';return;}
   const before=field.value;
   try{
    const next=await global.navigator.clipboard.readText();
    if(!isUnlocked()){clearOnLock();return;}
    if(generation!==clipboardGeneration||field.value!==before){status.textContent='Nội dung đã thay đổi. Không nối tin cũ.';return;}
    if(!next.trim()){status.textContent='Không có tin chữ để nối.';return;}
    // Repeated bets may be intentional: warn, but let the operator confirm.
    const normalizedBefore=before.replace(/\r\n/g,'\n').trimEnd();
    const normalizedNext=next.replace(/\r\n/g,'\n').trim();
    // Compare complete pasted blocks too: one Zalo message may contain several bet lines.
    const duplicate=Boolean(normalizedBefore && normalizedNext && (
     normalizedBefore.split('\n').some(line=>line.trim()===normalizedNext) ||
     normalizedBefore===normalizedNext ||
     normalizedBefore.startsWith(normalizedNext+'\n') ||
     normalizedBefore.endsWith('\n'+normalizedNext) ||
     normalizedBefore.includes('\n'+normalizedNext+'\n')
    ));
    if(duplicate){
     if(!global.confirm('Tin này đã xuất hiện trong nội dung. Vẫn nối thêm?')){
      status.textContent='Đã giữ nguyên nội dung, không nối tin trùng.';return;
     }
     if(!isUnlocked()){clearOnLock();return;}
     if(generation!==clipboardGeneration||field.value!==before){status.textContent='Nội dung đã thay đổi. Không nối tin cũ.';return;}
    }
    const combined=before.trimEnd()?(before.trimEnd()+'\n'+next):next;
    if(combined.length>field.maxLength){status.textContent='Tổng tin vượt 12.000 ký tự. Hãy chia thành nhiều lần.';return;}
    field.value=combined;updateCounter();reset();status.textContent='Đã nối tin Zalo. Hãy xem trước toàn bộ trước khi chuyển vào phơi.';
   }catch(err){if(generation!==clipboardGeneration)return;status.textContent='Không đọc được bộ nhớ tạm. Hãy dán thủ công vào ô Zalo.';}
  });
  clear.addEventListener('click',()=>{
   // An empty composer may still have a pending clipboard read. Clear must cancel it.
   if(!field.value&&!preview.textContent){clipboardGeneration++;status.textContent='Đã hủy thao tác dán đang chờ.';return;}
   if(!global.confirm('Xóa nội dung đang dán từ Zalo? Ô nhập phơi CUNCUN sẽ không bị thay đổi.'))return;
   clipboardGeneration++;field.value='';updateCounter();reset();status.textContent='Đã xóa nội dung dán Zalo. Ô nhập phơi vẫn giữ nguyên.';
  });
  review.addEventListener('click',()=>{
   if(!isUnlocked()){clearOnLock();return;}
   // Reviewing is a newer user action: an older clipboard request must not overwrite it.
   clipboardGeneration++;
   reset();const value=field.value.trim();
   if(!value){status.textContent='Hãy nhập hoặc dán nội dung trước';return}
   if(value.length>field.maxLength){status.textContent='Nội dung vượt quá 12.000 ký tự. Hãy chia thành nhiều lần để tránh mất tin.';return;}
   preview.textContent=value;preview.hidden=false;previewLabel.hidden=false;check.disabled=false;
   status.textContent='Kiểm tra nội dung và bảng giá đang chọn trong CUNCUN trước khi xác nhận';
  });
  check.addEventListener('change',()=>{if(!isUnlocked()){clearOnLock();return;}transfer.disabled=!check.checked||preview.hidden});
  transfer.addEventListener('click',()=>{
   if(transfer.disabled||preview.hidden||!check.checked)return;
   const bets=doc.getElementById('bets');
   if(!bets||!('value' in bets)){status.textContent='Không tìm thấy ô nhập phơi CUNCUN';return}
   const value=preview.textContent;if(!value)return;
   // A programmatic edit may bypass the input event; reject stale review text.
   if(value.length>field.maxLength){reset();status.textContent='Nội dung vượt quá 12.000 ký tự. Hãy chia thành nhiều lần.';return}
   if(field.value.trim()!==value){reset();status.textContent='Nội dung đã thay đổi, hãy xem trước và xác nhận lại';return}
   // Reject imports if the application is locked, even when the panel remains in the DOM.
   if(!isUnlocked()){
    status.textContent='CUNCUN đang khóa. Hãy mở khóa phần mềm trước khi nhập phơi.';return;
   }
   const originalBets=bets.value;
   const existing=originalBets.trim();
   // Preserve original text exactly, but avoid silently merging an unfinished bet.
   if(existing&&!/[.。]\s*$/.test(originalBets)){
    status.textContent='Ô phơi hiện tại chưa kết thúc bằng dấu chấm. Hãy kiểm tra và hoàn tất phơi cũ trước khi nối tin Zalo.';
    return;
   }
   if(existing&&!global.confirm('Ô nhập đã có nội dung. Chọn OK để nối thêm tin Zalo; Hủy để giữ nguyên.'))return;
   // A native confirmation can outlive a session lock; revalidate before writing.
   if(!isUnlocked()){clearOnLock();return;}
   if(field.value.trim()!==value||preview.hidden||!check.checked){reset();status.textContent='Nội dung đã thay đổi. Hãy xác nhận lại.';return;}
   if(bets.value!==originalBets){status.textContent='Ô nhập phơi đã thay đổi trong lúc xác nhận. Hãy kiểm tra lại trước khi chuyển tin Zalo.';return;}
   bets.value=(existing?bets.value.replace(/\s*$/,'')+'\n':'')+value;
   // Match the existing Telegram manual-import event contract so calculator listeners
   // can distinguish a user-confirmed chat paste from ordinary typing.
   bets.dispatchEvent(new global.CustomEvent('input',{bubbles:true,detail:{ottChatManualImport:true,zaloManualImport:true}}));
   bets.dispatchEvent(new global.Event('change',{bubbles:true}));
   clipboardGeneration++;reset();field.value='';updateCounter();title.open=true;bets.focus();if(typeof bets.scrollIntoView==='function')bets.scrollIntoView({behavior:'smooth',block:'center'});
   status.textContent='Đã chuyển vào ô nhập. Hãy kiểm tra kết quả trước khi bấm OK; chưa lưu hoặc in.';
  });
  for(const el of [note,composer,counter,actions,previewLabel,preview,reminder,consent,transferArea,status])title.append(el);
  root.append(title);host.append(root);return root;
 }
 global.CuncunZaloManualImport=Object.freeze({mount});
})(window);
