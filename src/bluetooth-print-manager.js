/* Local-only Bluetooth print history manager; never sends slips to a server. */
(function(root) {
  'use strict';
  if (!root) return;
  const KEY = 'TSH_PRINT_HISTORY_V1';
  const utils = root.TSHPrintHistoryUtils;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read = () => { try { const data = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(data) ? data : []; } catch { return []; } };
  const write = entries => localStorage.setItem(KEY, JSON.stringify(entries.slice(-1000)));

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
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <button type="button" data-action="copy-all" style="background:#229ed9;color:#fff;border-radius:10px;padding:12px 5px;font-weight:800">📋 SAO CHÉP TẤT CẢ</button>
          <button type="button" data-action="delete-all" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;border-radius:10px;padding:12px 5px;font-weight:800">🗑 XOÁ TOÀN BỘ</button>
        </div>
        <div id="bluetoothPrintList"></div>
      </div></section>`;
    document.body.appendChild(backdrop);
    function render() {
      const entries = read().slice().sort((a,b) => (b.lastPrintedAt || 0) - (a.lastPrintedAt || 0));
      const list = backdrop.querySelector('#bluetoothPrintList');
      list.innerHTML = entries.length ? entries.map((item, idx) => `
        <article data-id="${escape(item.id)}" style="background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:11px;margin:9px 0">
          <strong>Phơi ${idx + 1} • ${escape(item.customer || 'Không tên')}</strong>
          <div style="color:#64748b;font-size:12px">${escape(item.date || '')} • Đã xác nhận in ×${Number(item.printCount) || 1}</div>
          <pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;background:#f1f5f9;padding:9px;border-radius:8px;font-size:12px">${escape(utils.message(item))}</pre>
          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">
            <button type="button" data-action="copy" style="background:#dbeafe;color:#1d4ed8;border-radius:8px;padding:9px 3px;font-weight:800">📋 COPY TIN</button>
            <button type="button" data-action="print" style="background:#dcfce7;color:#166534;border-radius:8px;padding:9px 3px;font-weight:800">🖨 IN LẠI</button>
            <button type="button" data-action="delete" style="background:#fee2e2;color:#991b1b;border-radius:8px;padding:9px 3px;font-weight:800">🗑 XOÁ</button>
          </div>
        </article>`).join('') : '<p style="text-align:center;padding:28px 8px;color:#64748b">Chưa có phơi được xác nhận đã in.</p>';
    }
    backdrop.addEventListener('click', async event => {
      const button = event.target.closest('[data-action]');
      if (!button || !backdrop.contains(button)) return;
      const action = button.dataset.action;
      if (action === 'close') { backdrop.remove(); return; }
      const id = button.closest('[data-id]')?.dataset.id;
      const entries = read();
      const item = entries.find(row => String(row.id) === id);
      try {
        if (action === 'copy-all') {
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
          if (!root.TSHIOSSharePhoi) throw Error('Chưa sẵn sàng in Bluetooth.');
          await root.TSHIOSSharePhoi.share(String(item.text || utils.message(item)));
          if (confirm('Máy in đã in xong phơi này? Chỉ chọn OK nếu giấy đã ra thành công.')) {
            item.printCount = (Number(item.printCount) || 1) + 1;
            item.lastPrintedAt = Date.now(); write(entries); render();
          }
        }
      } catch (error) {
        if (error?.name !== 'AbortError') alert('Không thực hiện được: ' + (error?.message || String(error)));
      }
    });
    render();
  }
  root.TSHBluetoothPrintManager = {open};
  document.addEventListener('click', event => {
    if (event.target.closest('#openBluetoothPrintManager')) {event.preventDefault(); open();}
  });
})(typeof window !== 'undefined' ? window : null);
