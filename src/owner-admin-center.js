/* Branch-only preview integration. No database writes, no new RPC dependencies.
 * Enabled explicitly with ?admin_preview=1; never auto-opens.
 * The embedded prototype has a sandboxed origin and mock data only.
 */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('admin_preview') !== '1') return;

  let inFlight = false;
  let lastAllowed = false;
  let lastCheck = 0;
  let authEpoch = 0;
  let wasUnlocked = false;
  let overlay = null;

  const css = document.createElement('style');
  css.textContent = `
    #ownerAdminPreviewOpen{position:fixed;right:14px;bottom:15px;z-index:98000;background:#a94025;color:white;border:0;border-radius:13px;padding:12px 15px;font:800 13px system-ui;box-shadow:0 7px 24px #0003}
    #ownerAdminPreviewOverlay{position:fixed;inset:0;z-index:250000;background:#0b1224e8;display:flex;flex-direction:column;padding:12px;gap:9px}
    #ownerAdminPreviewOverlay .preview-head{color:#fff;display:flex;align-items:center;justify-content:space-between;gap:10px;font:800 15px system-ui}
    #ownerAdminPreviewOverlay .preview-close{border:0;background:#fff;border-radius:8px;padding:9px 13px;font:800 13px system-ui;color:#253047}
    #ownerAdminPreviewOverlay iframe{border:0;border-radius:11px;background:white;flex:1;width:100%;min-height:0}
  `;
  document.head.append(css);
  const open = document.createElement('button');
  open.id = 'ownerAdminPreviewOpen';
  open.type = 'button';
  open.textContent = '👑 ADMIN MẪU';
  open.hidden = true;
  document.body.append(open);

  function close() {
    overlay?.remove();
    overlay = null;
    open.focus();
  }
  function show() {
    if (!lastAllowed || !document.body.classList.contains('app-unlocked')) return;
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'ownerAdminPreviewOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Trung tâm quản lý bản mẫu');
    const head = document.createElement('div');
    head.className = 'preview-head';
    const title = document.createElement('span');
    title.textContent = 'ÔNG THẦN TÀI · GIAO DIỆN THỬ NGHIỆM (DỮ LIỆU GIẢ)';
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'preview-close';
    dismiss.textContent = 'ĐÓNG ×';
    dismiss.addEventListener('click', close);
    head.append(title, dismiss);
    const frame = document.createElement('iframe');
    frame.title = 'Trung tâm quản lý khách hàng — dữ liệu giả';
    frame.sandbox = 'allow-scripts';
    frame.src = 'prototypes/admin-customer-center.html';
    overlay.append(head, frame);
    document.body.append(overlay);
    dismiss.focus();
  }
  open.addEventListener('click', show);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && overlay) close(); });

  async function refreshPermission() {
    const unlocked = document.body.classList.contains('app-unlocked');
    if (unlocked !== wasUnlocked) {
      authEpoch += 1;
      wasUnlocked = unlocked;
      lastAllowed = false;
      lastCheck = 0;
      open.hidden = true;
      if (overlay) close();
    }
    if (!unlocked) return;
    if (inFlight || Date.now() - lastCheck < 5000) return;
    if (typeof sb === 'undefined' || typeof sb.rpc !== 'function') return;
    inFlight = true;
    lastCheck = Date.now();
    const requestEpoch = authEpoch;
    try {
      const { data, error } = await sb.rpc('check_email_license');
      if (requestEpoch !== authEpoch) return;
      lastAllowed = !error && data?.success === true && data?.is_admin === true
        && document.body.classList.contains('app-unlocked');
      open.hidden = !lastAllowed;
      if (!lastAllowed && overlay) close();
    } catch {
      lastAllowed = false;
      open.hidden = true;
      if (overlay) close();
    } finally {
      inFlight = false;
      if (requestEpoch !== authEpoch) queueMicrotask(refreshPermission);
    }
  }
  new MutationObserver(refreshPermission).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshPermission(); });
  refreshPermission();
})();
