/* Local-only Bluetooth print history manager; never sends slips to a server. */
(function(root) {
  'use strict';
  if (!root) return;
  const KEY = 'TSH_PRINT_HISTORY_V1';
  const utils = root.TSHPrintHistoryUtils;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read = () => { try { const data = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(data) ? data : []; } catch { return []; } };
  const RETENTION_MS = 48 * 60 * 60 * 1000;
  const stamp = item => Number(item.createdAt || item.lastPrintedAt || Date.parse(item.date || '')) || 0;
  const keep = entries => entries.filter(item => stamp(item) && Date.now() - stamp(item) < RETENTION_MS && Date.now() >= stamp(item) - 60000);
  const write = entries => localStorage.setItem(KEY, JSON.stringify(keep(entries).slice(-1000)));
  function region(item) {
    const raw = String(item.raw || item.text || '').toLowerCase();
    const first = raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)[0] || '';
    if (/^(hn|mb|hanoi|ha noi|2dmb|mien bac|miền bắc)\b/i.test(first)) return 'MB';
    if (/^(2dmt|3dmt|mt|mien trung|miền trung)\b/i.test(first)) return 'MT';
    if (/^(2dmn|3dmn|4dmn|mn|mien nam|miền nam)\b/i.test(first)) return 'MN';
    if (/\b(hn|hanoi|ha noi|mb)\b/i.test(raw)) return 'MB';
    if (/\b(dlak|qnam|dnang|kh|bdinh|qtri|glai|nthuan|qngai|ktum|hue|qb)\b/i.test(raw)) return 'MT';
    return 'MN';
  }
  const dayKey = item => {
    const t = stamp(item);
    if (t) { const d = new Date(t); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); }
    return String(item.date || '').slice(0,10);
  };
  const currentDay = () => dayKey({createdAt:Date.now()});

  async function copyToClipboard(text) {
    if (!text.trim()) throw Error('Không có nội dung phơi để sao chép.');
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); return; } catch (_) { /* iOS fallback */ }
    }
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;top:0;left:-9999px';
    document.body.appendChild(el);
    el.focus(); el.select(); el.setSelectionRange(0, el.value.length);
    const copied = document.execCommand('copy');
    el.remove();
    if (!copied) throw Error('iPhone không cho phép sao chép. Hãy thử lại bằng Safari.');
  }

  function open() {
    document.getElementById('bluetoothPrintManager')?.remove();
    const backdrop = document.createElement('div');
    backdrop.id = 'bluetoothPrintManager';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:310000;background:rgba(15,23,42,.78);padding:10px;overflow:auto';
    backdrop.innerHTML = `<section style="width:min(780px,100%);margin:auto;background:#f8fafc;border-radius:15px;overflow:hidden">
      <header style="position:sticky;top:0;z-index:1;background:#172554;color:#fff;padding:12px;display:flex;align-items:center;gap:9px">
        <strong style="flex:1">🖨️ QUẢN LÝ IN BLUETOOTH</strong><button type="button" data-action="close" style="background:#fff;color:#111827;border-radius:8px;padding:8px">✕</button>
      </header>
      <div style="padding:10px">
        <p style="font-size:12px;color:#475569;margin:4px 0 12px">Lịch sử chỉ lưu trên trình duyệt này. Sao chép tin để tự dán sang Telegram; phần mềm không tự gửi.</p>
        <p style="font-size:12px;color:#64748b;margin:0 0 8px">Tự lưu tối đa 48 giờ. Ngày cũ tự thu gọn; hết 48 giờ tự xóa trên thiết bị.</p>
        <div id="bluetoothPrintList"></div>

      </div></section>`;
    document.body.appendChild(backdrop);
    const selected = new Set();
    const expanded = new Set();
    let activeRegion = 'MN';
    let actionsOpen = false;
    const dayClosed = new Set();
    function notify(message) {
      const old=backdrop.querySelector('#tshPrintNotice'); if(old)old.remove();
      const el=document.createElement('div');
      el.id='tshPrintNotice';
      el.style.cssText='position:sticky;bottom:12px;z-index:15;margin:10px auto;max-width:550px;background:#172554;color:white;padding:13px;border-radius:10px;font-size:14px;box-shadow:0 5px 20px #0005';
      el.textContent=message;
      backdrop.querySelector('section')?.appendChild(el);
    }
    function askDelete(message) {
      return new Promise(resolve=>{
        const layer=document.createElement('div');
        layer.style.cssText='position:fixed;inset:0;z-index:320000;background:#0009;display:flex;align-items:center;justify-content:center;padding:20px';
        const panel=document.createElement('div');
        panel.style.cssText='background:white;color:#111827;border-radius:14px;padding:20px;max-width:350px;width:100%;box-sizing:border-box';
        const msg=document.createElement('p');msg.textContent=message;msg.style.cssText='font-size:16px;line-height:1.5;margin:0 0 18px';
        const controls=document.createElement('div');controls.style.cssText='display:flex;gap:10px';
        const cancel=document.createElement('button');cancel.type='button';cancel.textContent='HỦY';cancel.style.cssText='flex:1;padding:13px;background:#e2e8f0;border-radius:9px';
        const accept=document.createElement('button');accept.type='button';accept.textContent='XÁC NHẬN XÓA';accept.style.cssText='flex:1;padding:13px;background:#dc2626;color:white;border-radius:9px';
        function done(value){layer.remove();resolve(value);}
        cancel.addEventListener('click',e=>{e.stopPropagation();done(false)});
        accept.addEventListener('click',e=>{e.stopPropagation();done(true)});
        controls.append(cancel,accept);panel.append(msg,controls);layer.append(panel);backdrop.append(layer);
      });
    }
    function render() {
      const all = read(), entries = keep(all);
      if (all.length !== entries.length) write(entries);
      const list = backdrop.querySelector('#bluetoothPrintList');
      const regions = ['MN','MT','MB'];
      const rows = entries.filter(x=>region(x)===activeRegion).sort((x,y)=>stamp(y)-stamp(x));
      const days = [...new Set(rows.map(dayKey))].sort().reverse();
      const btn = 'border:0;border-radius:8px;padding:10px 5px;font-size:13px;font-weight:700;min-height:40px;';
      list.innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:10px">'+regions.map(reg=>
          '<button type="button" data-action="region" data-region="'+reg+'" style="'+btn+'background:'+(reg===activeRegion?'#1d4ed8':'#e2e8f0')+';color:'+(reg===activeRegion?'#fff':'#334155')+'">'+reg+' ('+entries.filter(x=>region(x)===reg).length+')</button>'
        ).join('')+'</div>'+
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:12px;color:#475569">'+selected.size+' tin đã chọn · Lưu 48 giờ</span><button type="button" data-action="toggle-actions" style="'+btn+'background:#dbeafe;color:#1e40af;padding:8px 12px">'+(actionsOpen?'▴ Thu gọn':'⚙ Thao tác ▾')+'</button></div>'+
        (actionsOpen?'<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:10px">'+
          '<button data-action="select-region" style="'+btn+'background:#dbeafe">☑ Chọn tất cả</button>'+
          '<button data-action="unselect-region" style="'+btn+'background:#e2e8f0">Bỏ chọn</button>'+
          '<button data-action="copy-region" style="'+btn+'background:#dbeafe;color:#1e40af">📋 Copy tất cả</button>'+
          '<button data-action="copy-selected" style="'+btn+'background:#bfdbfe;color:#1e3a8a">📋 Copy đã chọn</button>'+
          '<button data-action="delete-selected" style="'+btn+'background:#ffedd5;color:#9a3412">🗑 Xóa đã chọn</button>'+
          '<button data-action="delete-region" style="'+btn+'background:#fee2e2;color:#991b1b">🗑 Xóa tất cả</button></div>':'')+
        (days.length?days.map(day=>{
          const group=rows.filter(x=>dayKey(x)===day);
          const key=activeRegion+'-'+day;
          const closed=dayClosed.has(key)||day!==currentDay()&&!expanded.has(key);
          return '<div style="margin-bottom:9px"><button type="button" data-action="toggle-day" data-key="'+key+'" style="'+btn+'width:100%;text-align:left;background:#e0e7ff;color:#1e3a8a;padding:10px"> '+(closed?'▸':'▾')+' '+day.split('-').reverse().join('/')+' ('+group.length+' phơi)</button>'+
            (closed?'':group.map(item=>'<article data-id="'+escape(item.id)+'" style="border:1px solid #cbd5e1;border-radius:10px;background:#fff;padding:10px;margin-top:7px">'+
              '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" data-select-id="'+escape(item.id)+'" '+(selected.has(String(item.id))?'checked':'')+' style="width:19px;height:19px;flex:none"><strong>'+escape(item.customer||'Phơi')+'</strong></label>'+
              '<small style="display:block;color:#64748b;margin:4px 0">'+(item.printStatus==='sent'?'Đã gửi lệnh':'Đã xác nhận in')+' ×'+(Number(item.printCount)||1)+'</small>'+
              '<pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:130px;overflow:auto;background:#f1f5f9;padding:9px;border-radius:8px;font-size:12px">'+escape(item.raw||utils.message(item))+'</pre>'+
              '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px">'+
              '<button type="button" data-action="edit" style="'+btn+'background:#fef3c7;color:#92400e">✏️ Sửa</button>'+
              '<button type="button" data-action="copy" style="'+btn+'background:#dbeafe;color:#1e40af">📋 Copy</button>'+
              '<button type="button" data-action="print" style="'+btn+'background:#dcfce7;color:#166534">🖨 In lại</button>'+
              '<button type="button" data-action="delete" style="'+btn+'background:#fee2e2;color:#991b1b">🗑 Xóa</button></div></article>').join(''))+'</div>';
        }).join(''):'<p style="padding:24px;text-align:center;color:#64748b">Chưa có phơi '+activeRegion+'.</p>');
    }
    backdrop.addEventListener('click', async event => {
      const button = event.target.closest('[data-action]');
      if (!button || !backdrop.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.action;
      if (action === 'close') { backdrop.remove(); return; }
      const id = button.closest('[data-id]')?.dataset.id;
      const entries = keep(read());
      const item = entries.find(row => String(row.id) === id);
      try {
        if (action === 'region') {
          activeRegion=button.dataset.region; render();
        } else if (action === 'toggle-actions') {
          actionsOpen=!actionsOpen; render();
        } else if (action === 'toggle-day') {
          const key=button.dataset.key;
          if(dayClosed.has(key)){dayClosed.delete(key);expanded.add(key);}
          else if(expanded.has(key)){expanded.delete(key);dayClosed.add(key);}
          else if(key.endsWith(currentDay()))dayClosed.add(key);
          else expanded.add(key);
          render();
        } else if (action === 'select-region') {
          entries.filter(x=>region(x)===activeRegion).forEach(x=>selected.add(String(x.id)));render();
        } else if (action === 'unselect-region') {
          entries.filter(x=>region(x)===activeRegion).forEach(x=>selected.delete(String(x.id)));render();
        } else if (action === 'copy-region' || action === 'copy-selected') {
          const rows=entries.filter(x=>region(x)===activeRegion&&(action==='copy-region'||selected.has(String(x.id)))).sort((a,b)=>stamp(a)-stamp(b));
          if(!rows.length){notify('Không có tin nào để sao chép.');return;}
          await copyToClipboard(rows.map(x=>String(x.raw||utils.message(x))).join('\n\n'));
          alert('Đã sao chép '+rows.length+' tin '+activeRegion+'.');
        } else if (action === 'delete-region' || action === 'delete-selected') {
          const targets=entries.filter(x=>region(x)===activeRegion&&(action==='delete-region'||selected.has(String(x.id))));
          if(!targets.length)return;
          if(!await askDelete('Xóa '+targets.length+' phơi '+activeRegion+'? Không thể hoàn tác.'))return;
          const ids=new Set(targets.map(x=>String(x.id)));
          write(entries.filter(x=>!ids.has(String(x.id))));
          ids.forEach(id=>selected.delete(id));render();
        } else if (action === 'edit' && item) {
          const article=button.closest('[data-id]');
          const pre=article?.querySelector('pre');
          if(!pre)return;
          const editor=document.createElement('textarea');
          editor.setAttribute('aria-label','Sửa nội dung phơi');
          editor.style.cssText='width:100%;min-height:140px;font-size:16px;padding:10px;border:2px solid #2563eb;border-radius:8px;box-sizing:border-box';
          editor.value=String(item.raw||item.text||'');
          pre.replaceWith(editor);
          const controls=article.querySelector('div[style*="display:grid"]');
          if(controls)controls.innerHTML='<button type="button" data-action="save-edit" style="padding:12px;background:#16a34a;color:white;border-radius:8px">💾 Lưu sửa</button><button type="button" data-action="cancel-edit" style="padding:12px;background:#e2e8f0;border-radius:8px">Hủy</button>';
          editor.focus();
        } else if (action === 'save-edit' && item) {
          const value=button.closest('[data-id]')?.querySelector('textarea')?.value.trim();
          if(!value){notify('Nội dung không được để trống.');return;}
          item.raw=value;item.text=value;item.editedAt=Date.now();
          write(entries);render();
          notify('Đã lưu nội dung sửa. Không tự in lại.');
        } else if (action === 'cancel-edit') {
          render();
        } else if (action === 'copy-all') {
          if (!entries.length) { alert('Chưa có phơi đã in để sao chép.'); return; }
          await copyToClipboard(utils.combined(entries.slice().sort((a,b) => (b.lastPrintedAt || 0) - (a.lastPrintedAt || 0))));
          alert('Đã sao chép toàn bộ ' + entries.length + ' tin. Mở Telegram và DÁN.');
        } else if (action === 'copy' && item) {
          await copyToClipboard(utils.message(item));
          notify('Đã sao chép tin này. Mở Telegram và DÁN.');
        } else if (action === 'delete' && item) {
          if (!await askDelete('Xóa riêng phơi này khỏi lịch sử trên iPhone? Không thể hoàn tác.')) return;
          write(entries.filter(row => String(row.id) !== id)); render();
        } else if (action === 'delete-all') {
          if (!entries.length) return;
          if (!await askDelete('XÓA TOÀN BỘ ' + entries.length + ' phơi đã in? Không thể hoàn tác.')) return;
          write([]); render();
        } else if (action === 'print' && item) {
          const receipt = String(item.text || utils.message(item));
          if (root.TSHNativePrintBridge?.available()) {
            // Reprint using the same iPhone -> Wi-Fi printer transport as IN TRUC TIEP.
            const result = await root.TSHNativePrintBridge.send(receipt);
            if (!result?.sent) throw Error('Máy in chưa xác nhận đã nhận lệnh.');
            item.printCount = (Number(item.printCount) || 1) + 1;
            item.lastPrintedAt = Date.now();
            item.printStatus = 'sent';
            write(entries); render();
            notify('Đã gửi lệnh IN LẠI. Hãy kiểm tra giấy in.');
          } else {
            // Browser-only fallback; do not claim the share sheet has printed.
            if (!root.TSHIOSSharePhoi) throw Error('Chưa sẵn sàng in.');
            await root.TSHIOSSharePhoi.share(receipt);
            if (confirm('Phiếu đã in ra giấy đầy đủ chưa? Chỉ bấm OK nếu đã in xong.')) {
              item.printCount = (Number(item.printCount) || 1) + 1;
              item.lastPrintedAt = Date.now();
              item.printStatus = 'confirmed';
              write(entries); render();
            }
          }
        }
      } catch (error) {
        if (error?.name !== 'AbortError') notify('Không thực hiện được: ' + (error?.message || String(error)));
      }
    });
    backdrop.addEventListener('change',event=>{
      const id=event.target?.dataset?.selectId;
      if(!id)return;
      if(event.target.checked)selected.add(id);else selected.delete(id);
      const label=backdrop.querySelector('[data-action="toggle-actions"]')?.previousElementSibling;
      if(label)label.textContent=selected.size+' tin đã chọn · Lưu 48 giờ';
    });
    // Prevent global calculator click handlers from intercepting manager controls.
    backdrop.addEventListener('click',event=>event.stopPropagation());
    render();
  }
  root.TSHBluetoothPrintManager = {open};
  document.addEventListener('click', event => {
    if (event.target.closest('#openBluetoothPrintManager')) {event.preventDefault(); open();}
  });
})(typeof window !== 'undefined' ? window : null);
