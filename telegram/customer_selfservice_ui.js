/* CUNCUN Telegram self-service UI, staging only.
 * Host app must call mountTelegramSelfService(root, { apiBase, getAccessToken }).
 * Never persist OTP, 2FA password or bearer token in localStorage.
 * Requires same-origin or explicitly allowed CORS on the protected API.
 */
export function mountTelegramSelfService(root, { apiBase, getAccessToken }) {
  if (!root || typeof getAccessToken !== "function") throw new Error("Missing authenticated host");
  const base = String(apiBase || "").replace(/\/$/, "");
  const state = { groups: [], selected: new Set(), connected: false };
  const form = document.createElement("div");
  form.className = "cuncun-telegram-selfservice";
  const heading = document.createElement("h3");
  heading.textContent = "Kết nối Telegram";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const phone = document.createElement("input");
  phone.type = "tel"; phone.placeholder = "+849xxxxxxxx"; phone.autocomplete = "tel";
  const code = document.createElement("input");
  code.type = "text"; code.placeholder = "Mã OTP Telegram"; code.autocomplete = "one-time-code";
  const password = document.createElement("input");
  password.type = "password"; password.placeholder = "Mật khẩu xác minh 2 bước"; password.autocomplete = "off";
  const buttons = [
    ["Gửi mã Telegram", () => request("/telegram-login/start", { phone: phone.value })],
    ["Xác nhận OTP", () => request("/telegram-login/confirm", { code: code.value })],
    ["Xác nhận mật khẩu 2 bước", () => request("/telegram-login/password", { password: password.value })],
    ["Lấy danh sách nhóm", loadGroups],
    ["Lưu nhóm đã chọn", saveGroups]
  ].map(([label, action]) => {
    const button = document.createElement("button");
    button.type = "button"; button.textContent = label;
    button.addEventListener("click", async () => {
      button.disabled = true;
      try { await action(); } catch (error) { status.textContent = error.message || "Không thể kết nối"; }
      finally { button.disabled = false; code.value = ""; password.value = ""; }
    });
    return button;
  });
  const groupsEl = document.createElement("div");
  groupsEl.setAttribute("role", "group");
  groupsEl.setAttribute("aria-label", "Nhóm Telegram muốn đồng bộ");
  form.append(heading, status, phone, buttons[0], code, buttons[1], password, buttons[2], buttons[3], groupsEl, buttons[4]);
  root.replaceChildren(form);
  form.hidden = true;
  api("/capabilities").then(capabilities => {
    if (!capabilities.licensed) {
      status.textContent = "Tài khoản chưa có quyền sử dụng CUNCUN.";
      root.replaceChildren(status);
      return;
    }
    if (!capabilities.telegram_login_enabled) {
      status.textContent = "Tính năng Telegram tự kết nối chưa được kích hoạt.";
      root.replaceChildren(status);
      return;
    }
    form.hidden = false;
    status.textContent = "Nhập số điện thoại Telegram để bắt đầu.";
  }).catch(() => {
    status.textContent = "Không kiểm tra được quyền kết nối Telegram.";
    root.replaceChildren(status);
  });

  async function api(path, body) {
    const token = await getAccessToken();
    if (!token) throw new Error("Vui lòng đăng nhập CUNCUN");
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: "Bearer " + token, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
      credentials: "omit"
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || "Yêu cầu thất bại (" + response.status + ")");
    return result;
  }
  async function request(path, body) {
    const result = await api(path, body);
    if (result.step === "password") status.textContent = "Nhập mật khẩu xác minh 2 bước Telegram";
    else if (result.step === "connected") { state.connected = true; status.textContent = "Đã lưu phiên Telegram. Chọn nhóm để đồng bộ."; }
    else status.textContent = "Đã gửi yêu cầu. Kiểm tra Telegram để lấy mã.";
  }
  async function loadGroups() {
    const [available, saved] = await Promise.all([
      api("/telegram-login/groups"), api("/telegram-login/groups/selection")
    ]);
    state.groups = Array.isArray(available.groups) ? available.groups : [];
    state.selected = new Set(saved.chat_ids || []);
    groupsEl.replaceChildren();
    for (const group of state.groups) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.selected.has(String(group.chat_id));
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.selected.add(String(group.chat_id));
        else state.selected.delete(String(group.chat_id));
      });
      label.append(checkbox, document.createTextNode(" " + group.name));
      groupsEl.append(label, document.createElement("br"));
    }
    status.textContent = "Đã tải " + state.groups.length + " nhóm. Chọn nhóm muốn đồng bộ.";
  }
  async function saveGroups() {
    const result = await api("/telegram-login/groups/select", { chat_ids: [...state.selected] });
    status.textContent = "Đã lưu " + result.selected_count + " nhóm. Đồng bộ chưa được kích hoạt trên VPS.";
  }
  return { refresh: loadGroups, destroy: () => root.replaceChildren() };
}
