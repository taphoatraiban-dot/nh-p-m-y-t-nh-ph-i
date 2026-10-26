/* RELEASE CANDIDATE ONLY. Disabled unless ?admin_center_candidate=1.
 * Requires separately approved database RPC migrations. No direct table writes.
 * Existing production builds do not load this module.
 */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('admin_center_candidate') !== '1') return;

  const create = (tag, content = '', className = '') => {
    const el = document.createElement(tag);
    if (content) el.textContent = content;
    if (className) el.className = className;
    return el;
  };
  const style = create('style');
  style.textContent = `
    #customerCenterEntry{position:fixed;bottom:16px;right:16px;z-index:98010;background:#9f3b22;color:white;border:0;border-radius:13px;padding:12px 15px;font:800 14px system-ui;box-shadow:0 8px 24px #0003}
    #customerCenterRoot{position:fixed;inset:0;z-index:250100;background:#eef2f8;overflow:auto;padding:20px;font:14px system-ui;color:#1e293b}
    #customerCenterRoot .cc-shell{max-width:1100px;margin:auto;display:grid;gap:15px}
    #customerCenterRoot .cc-card{background:#fff;border:1px solid #dbe2ee;border-radius:13px;padding:17px}
    #customerCenterRoot .cc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    #customerCenterRoot .cc-row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;border-bottom:1px solid #edf0f4;padding:11px 0}
    #customerCenterRoot .cc-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,380px);gap:14px}
    #customerCenterRoot .cc-form{display:grid;gap:10px}
    #customerCenterRoot input,#customerCenterRoot select,#customerCenterRoot textarea{font:inherit;border:1px solid #cad3e1;border-radius:8px;padding:10px;max-width:100%;width:100%;box-sizing:border-box}
    #customerCenterRoot button{font:700 13px system-ui;padding:9px 12px;border:1px solid #cbd5e1;background:#fff;color:#25364b;border-radius:8px;cursor:pointer}
    #customerCenterRoot button:disabled{opacity:.55;cursor:not-allowed}
    #customerCenterRoot .cc-alert{background:#fff4d6;color:#755014;border:1px solid #ecd497;border-radius:9px;padding:10px}
    #customerCenterRoot .cc-error{color:#ac283e;white-space:pre-wrap}
    #customerCenterRoot label{display:grid;gap:5px}
    @media(max-width:720px){#customerCenterRoot{padding:10px}#customerCenterRoot .cc-grid{grid-template-columns:1fr}}
  `;
  document.head.append(style);

  const entry = create('button', '👑 Trung tâm khách hàng');
  entry.id = 'customerCenterEntry';
  entry.type = 'button';
  entry.hidden = true;
  document.body.append(entry);
  let epoch = 0, allowed = false, root = null, selected = null, rows = [], busy = false, loadError = '';

  function close() {
    if (root) root.remove();
    root = null;
    selected = null;
    rows = [];
    loadError = '';
    entry.focus();
  }
  function revoke() {
    epoch += 1;
    allowed = false;
    entry.hidden = true;
    close();
  }
  async function verify() {
    const ticket = epoch;
    if (!document.body.classList.contains('app-unlocked') || typeof sb === 'undefined' || typeof sb.rpc !== 'function') return false;
    try {
      const { data, error } = await sb.rpc('check_email_license');
      return ticket === epoch && document.body.classList.contains('app-unlocked') && !error && data?.success === true && data?.is_admin === true;
    } catch { return false; }
  }
  async function refreshEntry() {
    const ticket = epoch;
    const yes = await verify();
    if (ticket !== epoch) return;
    allowed = yes;
    entry.hidden = !yes;
    if (!yes) close();
  }
  function label(text, control) {
    const wrapper = create('label', text);
    wrapper.append(control);
    return wrapper;
  }
  function render() {
    if (!root || !allowed || !document.body.classList.contains('app-unlocked')) return;
    const shell = root.firstChild;
    shell.replaceChildren();
    const header = create('div', '', 'cc-card cc-head');
    const heading = create('div');
    heading.append(create('h2', 'Trung tâm quản lý khách hàng'), create('p', 'BẢN ỨNG VIÊN · Chỉ Admin · Chưa triển khai sản xuất'));
    const closeButton = create('button', 'Đóng');closeButton.addEventListener('click', close);
    header.append(heading, closeButton);shell.append(header);
    const alert = create('div', loadError || 'Dữ liệu được đọc qua RPC quản trị. Mọi thay đổi yêu cầu xác nhận và xử lý giao dịch tại máy chủ.', loadError?'cc-error':'cc-alert');shell.append(alert);
    const layout = create('div', '', 'cc-grid');shell.append(layout);
    const list = create('section', '', 'cc-card');layout.append(list);
    const details = create('section', '', 'cc-card');layout.append(details);
    const search = create('input');search.placeholder = 'Tìm email khách hàng';search.type = 'search';
    list.append(create('h3', 'Danh sách'), search);
    const listRows = create('div');list.append(listRows);
    const renderList = () => {
      listRows.replaceChildren();
      const filter = search.value.trim().toLocaleLowerCase('vi-VN');
      for (const row of rows.filter(r => String(r.email||'').toLocaleLowerCase('vi-VN').includes(filter))) {
        const line = create('div', '', 'cc-row');
        const info = create('span', `${row.email} · ${row.account_kind === 'pending' ? 'Chờ đăng ký' : row.license_active === false ? 'Tạm ngưng' : 'Đã đăng ký'}`);
        const button = create('button', 'Chi tiết');button.addEventListener('click',()=>{selected=row;renderDetails();});
        line.append(info,button);listRows.append(line);
      }
      if (!listRows.childNodes.length) listRows.append(create('p','Không có khách phù hợp.'));
    };
    const renderDetails = () => {
      details.replaceChildren();details.append(create('h3', 'Hồ sơ khách hàng'));
      if (!selected) { details.append(create('p','Chọn khách hàng để xem chi tiết.'));return; }
      details.append(create('p',selected.email));
      details.append(create('p',`Hạn: ${selected.expires_at||'Chưa có'} · Thiết bị: ${selected.device_count??0}`));
      if (selected.account_kind !== 'registered' || !selected.user_id || !Number.isSafeInteger(Number(selected.revision))) {
        details.append(create('p','Tài khoản chờ đăng ký hoặc thiếu phiên bản: chỉ xem.'));return;
      }
      const form = create('form','','cc-form');
      const action = create('select');for(const [id,title] of [['extend','Gia hạn'],['pause','Tạm ngưng'],['resume','Kích hoạt lại'],['reset_device','Đặt lại thiết bị']]){const option=create('option',title);option.value=id;action.append(option)}action.value='extend';
      const days = create('input');days.type='number';days.min='1';days.max='365';days.value='30';
      const daysLabel=label('Số ngày gia hạn',days);
      action.addEventListener('change',()=>{daysLabel.hidden=action.value!=='extend';});
      const reason=create('textarea');reason.maxLength=500;reason.placeholder='Lý do ít nhất 10 ký tự';
      const confirm=create('input');confirm.type='email';confirm.autocomplete='off';confirm.placeholder='Nhập đúng email khách hàng';
      const status=create('p','','cc-error');status.setAttribute('role','status');
      const submit=create('button','Xác nhận thao tác');submit.type='submit';
      form.append(label('Chức năng',action),daysLabel,label('Lý do',reason),label('Nhập lại email xác nhận',confirm),status,submit);
      form.addEventListener('submit',async event=>{
        event.preventDefault();
        if(busy || !allowed || !selected || !document.body.classList.contains('app-unlocked'))return;
        const subject=selected,operation=action.value,count=Number(days.value),note=reason.value.trim();
        if(confirm.value!==subject.email){status.textContent='Email xác nhận không đúng.';return;}
        if(note.length<10||note.length>500){status.textContent='Lý do phải từ 10 đến 500 ký tự.';return;}
        if(operation==='extend'&&(!Number.isSafeInteger(count)||count<1||count>365)){status.textContent='Số ngày phải từ 1 đến 365.';return;}
        if(!['extend','pause','resume','reset_device'].includes(operation)){status.textContent='Chức năng không hợp lệ.';return;}
        const ticket=epoch;busy=true;submit.disabled=true;status.textContent='Đang xác minh quyền và gửi yêu cầu…';
        try {
          if(!await verify() || ticket!==epoch)throw new Error('Phiên Admin không còn hợp lệ.');
          if(typeof crypto==='undefined'||typeof crypto.randomUUID!=='function')throw new Error('Không thể tạo mã yêu cầu an toàn.');
          const result=await sb.rpc('admin_customer_command',{
            p_request_id:crypto.randomUUID(),p_action:operation,p_user_id:subject.user_id,
            p_expected_revision:Number(subject.revision),p_days:operation==='extend'?count:null,p_reason:note
          });
          if(ticket!==epoch)return;
          if(result.error||result.data?.success!==true)throw new Error('Máy chủ không xác nhận. Tải lại trước khi thử tiếp.');
          selected=null;
          await loadRows();
        } catch(error) { if(ticket===epoch)status.textContent=error.message||'Thao tác không thành công.'; }
        finally{busy=false;submit.disabled=false;}
      });
      details.append(form);
    };
    search.addEventListener('input',renderList);
    renderList();renderDetails();
  }
  async function loadRows() {
    const ticket=epoch;
    if(!await verify()||ticket!==epoch){revoke();return;}
    try {
      const {data,error}=await sb.rpc('admin_customer_overview');
      if(ticket!==epoch)return;
      if(error||!Array.isArray(data))throw new Error('Không tải được danh sách quản trị.');
      loadError='';
      rows=data.filter(r=>r&&typeof r.email==='string').map(r=>Object.freeze({
        account_kind:r.account_kind,user_id:r.user_id,email:r.email,license_active:r.license_active,
        expires_at:r.expires_at,device_count:r.device_count,revision:r.revision
      }));
      render();
    } catch { if(ticket===epoch){rows=[];selected=null;loadError='Không tải được dữ liệu quản trị. RPC có thể chưa được triển khai. Chưa có thao tác nào được thực hiện.';render();} }
  }
  entry.addEventListener('click',()=>{
    if(!allowed || root || !document.body.classList.contains('app-unlocked'))return;
    root=create('div');root.id='customerCenterRoot';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
    root.append(create('main','','cc-shell'));document.body.append(root);loadRows();
  });
  new MutationObserver(()=>{
    if(!document.body.classList.contains('app-unlocked'))revoke();
    else if(!allowed)refreshEntry();
  }).observe(document.body,{attributes:true,attributeFilter:['class']});
  if(typeof sb!=='undefined'&&typeof sb.auth?.onAuthStateChange==='function'){
    sb.auth.onAuthStateChange(()=>{revoke();queueMicrotask(refreshEntry);});
  }
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root)close();});
  refreshEntry();
})();
