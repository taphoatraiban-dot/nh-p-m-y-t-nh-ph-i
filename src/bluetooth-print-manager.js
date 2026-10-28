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
    function render() {
      const all = read(), entries = keep(all);
      if (entries.length !== all.length) write(entries);
      const list = backdrop.querySelector('#bluetoothPrintList');
      const regions = ['MN','MT','MB'];
      list.innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;align-items:start">' + regions.map(reg => {
        const rows = entries.filter(x=>region(x)===reg);
        const days = [...new Set(rows.map(dayKey))].sort().reverse();
        return '<section style="min-width:0;background:#f1f5f9;border-radius:10px;padding:5px">' +
          '<strong style="display:block;text-align:center;color:#1e3a8a;padding:7px 0">'+reg+' ('+rows.length+')</strong>' +
          '<button type="button" data-action="select-region" data-region="'+reg+'" style="width:100%;font-size:11px;padding:7px 2px;background:#dbeafe;border-radius:7px">☑ Chọn tất cả</button>' +
          '<button type="button" data-action="delete-region" data-region="'+reg+'" style="width:100%;font-size:11px;padding:7px 2px;margin-top:4px;background:#fee2e2;color:#991b1b;border-radius:7px">🗑 Xóa tất cả</button>' +
          '<button type="button" data-action="delete-selected" data-region="'+reg+'" style="width:100%;font-size:11px;padding:7px 2px;margin-top:4px;background:#ffedd5;color:#9a3412;border-radius:7px">Xóa đã chọn</button>' +
          days.map(day => {
            const group = rows.filter(x=>dayKey(x)===day);
            const key=reg+'-'+day, opened=expanded.has(key)||day===currentDay();
            return '<div style="margin-top:8px"><button type="button" data-action="toggle-day" data-key="'+key+'" style="width:100%;padding:7px 2px;font-size:11px;background:#e0e7ff;border-radius:7px">'+(opened?'▾':'▸')+' '+day.slice(5)+' ('+group.length+')</button>' +
            (opened ? group.map(item => '<article data-id="'+escape(item.id)+'" style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:5px;margin-top:5px;overflow:hidden">' +
              '<label style="display:flex;align-items:center;gap:3px;font-size:11px"><input type="checkbox" data-select-id="'+escape(item.id)+'" '+(selected.has(String(item.id))?'checked':'')+' style="width:14px;height:14px"> <b>'+escape(item.customer||'Phơi')+'</b></label>' +
              '<small style="font-size:10px;color:#64748b">'+(item.printStatus==='sent'?'Đã gửi':'Đã in')+' ×'+(Number(item.printCount)||1)+'</small>' +
              '<pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:90px;overflow:auto;font-size:10px;background:#f8fafc;padding:4px">'+escape(utils.message(item))+'</pre>' +
              '<div style="display:grid;gap:3px"><button data-action="copy" style="font-size:11px">📋 Copy</button><button data-action="print" style="font-size:11px">🖨 In lại</button><button data-action="delete" style="font-size:11px;color:#b91c1c">🗑 Xóa</button></div></article>').join('') : '') + '</div>';
          }).join('') + '</section>';
      }).join('') + '</div>';
    }
    backdrop.addEventListener('click', async event => {
      const button = event.target.closest('[data-action]');
      if (!button || !backdrop.contains(button)) return;
      const action = button.dataset.action;
      if (action === 'close') { backdrop.remove(); return; }
      const id = button.closest('[data-id]')?.dataset.id;
      const entries = keep(read());
      const item = entries.find(row => String(row.id) === id);
      try {
        if (action === 'toggle-day') {
          const key=button.dataset.key;
          if(expanded.has(key)) expanded.delete(key); else expanded.add(key);
          // Today's group remains open by default.
          if(key.endsWith(currentDay()) && !expanded.has(key)) expanded.add(key);
          render();
        } else if (action === 'select-region') {
          entries.filter(x=>region(x)===button.dataset.region).forEach(x=>selected.add(String(x.id)));
          render();
        } else if (action === 'delete-region' || action === 'delete-selected') {
          const reg=button.dataset.region;
          const targets=entries.filter(x=>region(x)===reg && (action==='delete-region'||selected.has(String(x.id))));
          if(!targets.length) return;
          if(!confirm('Xóa '+targets.length+' phơi '+reg+' khỏi iPhone? Không thể hoàn tác.')) return;
          const ids=new Set(targets.map(x=>String(x.id)));
          write(entries.filter(x=>!ids.has(String(x.id))));
          ids.forEach(id=>selected.delete(id)); render();
        } else if (action === 'copy-all') {
          if (!entries.length) { alert('Chưa có phơi đã in để sao chép.'); return; }
          await copyToClipboard(utils.combined(entries.slice().sort((a,b) => (b.lastPrintedAt || 0) - (a.lastPrintedAt || 0))));
          alert('Đã sao chép toàn bộ ' + entries.length + ' tin. Mở Telegram và DÁN.');
        } else if (action === 'copy' && item) {
          await copyToClipboard(utils.message(item));
          alert('Đã sao chép tin này. Mở Telegram và DÁN.');
        } else if (action === 'delete' && item) {
          if (!confirm('Xoá riêng phơi này khỏi lịch sử trên iPhone? Không thể hoàn tác.')) return;
          write(entries.filter(row => String(row.id) !== id)); render();
        } else if (action === 'delete-all') {
          if (!entries.length) return;
          if (!confirm('XOÁ TOÀN BỘ ' + entries.length + ' phơi đã in trên trình duyệt này? Không thể hoàn tác.')) return;
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
            alert('Đã gửi lệnh IN LẠI đến máy in. Hãy kiểm tra giấy in.');
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
        if (error?.name !== 'AbortError') alert('Không thực hiện được: ' + (error?.message || String(error)));
      }
    });
    backdrop.addEventListener('change',event=>{
      const id=event.target?.dataset?.selectId;
      if(!id)return;
      if(event.target.checked)selected.add(id);else selected.delete(id);
    });
    render();
  }
  root.TSHBluetoothPrintManager = {open};
  document.addEventListener('click', event => {
    if (event.target.closest('#openBluetoothPrintManager')) {event.preventDefault(); open();}
  });
})(typeof window !== 'undefined' ? window : null);
