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
  root.style.cssText='border:1px solid #cbd5e1;border-radius:10px;padding:10px;margin:10px 0;background:#f8fbff;color:#17212f';
  const title=doc.createElement('details');const summary=doc.createElement('summary');
  summary.textContent='Dán tin Zalo cá nhân (thủ công)';title.append(summary);
  const note=doc.createElement('p');note.textContent='Không kết nối Zalo. Tin chỉ được đưa vào ô nhập sau khi bạn kiểm tra và xác nhận.';
  const field=doc.createElement('textarea');field.rows=5;field.maxLength=12000;
  field.placeholder='Sao chép nội dung trong Zalo rồi dán vào đây';field.setAttribute('aria-label','Nội dung Zalo sao chép');
  field.style.cssText='box-sizing:border-box;width:100%;font:16px system-ui;padding:9px;border:1px solid #94a3b8;border-radius:8px';
  const preview=doc.createElement('pre');preview.hidden=true;preview.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto';
  const review=doc.createElement('button');review.type='button';review.textContent='Xem trước';
  const consent=doc.createElement('label');consent.style.cssText='display:block;margin:8px 0';
  const check=doc.createElement('input');check.type='checkbox';check.disabled=true;
  consent.append(check,doc.createTextNode(' Tôi đã kiểm tra nội dung và đúng bảng giá trên CUNCUN'));
  const transfer=doc.createElement('button');transfer.type='button';transfer.textContent='Đưa vào ô nhập phơi';transfer.disabled=true;
  const status=doc.createElement('p');status.setAttribute('role','status');
  const reset=()=>{preview.hidden=true;preview.textContent='';check.checked=false;check.disabled=true;transfer.disabled=true};
  field.addEventListener('input',reset);
  review.addEventListener('click',()=>{
   reset();const value=field.value.trim();
   if(!value){status.textContent='Hãy dán nội dung trước';return}
   preview.textContent=value;preview.hidden=false;check.disabled=false;
   status.textContent='Kiểm tra nội dung và bảng giá đang chọn trong CUNCUN trước khi xác nhận';
  });
  check.addEventListener('change',()=>{transfer.disabled=!check.checked||preview.hidden});
  transfer.addEventListener('click',()=>{
   if(transfer.disabled||preview.hidden||!check.checked)return;
   const bets=doc.getElementById('bets');
   if(!bets||!('value' in bets)){status.textContent='Không tìm thấy ô nhập phơi CUNCUN';return}
   const value=preview.textContent;if(!value)return;
   const existing=bets.value.trim();
   if(existing&&!global.confirm('Ô nhập đã có nội dung. Chọn OK để nối thêm tin Zalo; Hủy để giữ nguyên.'))return;
   bets.value=(existing?bets.value.replace(/\s*$/,'')+'\n':'')+value;
   bets.dispatchEvent(new global.Event('input',{bubbles:true}));
   bets.dispatchEvent(new global.Event('change',{bubbles:true}));
   reset();field.value='';bets.focus();
   status.textContent='Đã chuyển vào ô nhập. Hãy kiểm tra kết quả trước khi bấm OK; chưa lưu hoặc in.';
  });
  for(const el of [note,field,review,preview,consent,transfer,status])title.append(el);
  root.append(title);host.append(root);return root;
 }
 global.CuncunZaloManualImport=Object.freeze({mount});
})(window);
