'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../prototypes/admin-customer-center.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

class Element {
  constructor(id = '', tag = 'div') {
    this.id = id; this.tag = tag; this.children = []; this.handlers = {};
    this.dataset = {}; this.attributes = {}; this.value = ''; this.hidden = false;
    this.textContent = ''; this.className = '';
    this.classList = { toggle() {} };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener(name, fn) { this.handlers[name] = fn; }
  dispatch(name) { this.handlers[name]?.({ target: this, preventDefault() {} }); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  focus() { this.focused = true; }
}

function launch() {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const map = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  map.filter.value = 'all'; map.sort.value = 'expiry'; map.demoRole.value = 'admin1';
  const pages = ['overview', 'customers', 'devices', 'audit', 'detail'].map(id => map[id]);
  const nav = ['overview', 'customers', 'devices', 'audit'].map(page => {
    const element = new Element('nav-'+page, 'button'); element.dataset.page = page; return element;
  });
  const document = {
    getElementById: id => map[id] || null,
    querySelectorAll: query => query === '.page' ? pages : query === '[data-page]' ? nav : [],
    createElement: tag => new Element('', tag)
  };
  vm.runInNewContext(script, { document, console });
  return { map, nav };
}

test('initial mock list sorts nearest expiry first with pending last', () => {
  const { map } = launch();
  const rows = map.customerRows.children;
  assert.equal(rows.length, 5);
  assert.equal(rows[0].children[0].textContent, 'khach-e@example.com');
  assert.equal(rows.at(-1).children[0].textContent, 'khach-d@example.com');
  assert.match(map.resultCount.textContent, /5 \/ 5/);
});

test('search, status filter, sorting and clear filters update visible list', () => {
  const { map } = launch();
  map.filter.value = 'soon'; map.filter.dispatch('change');
  assert.equal(map.customerRows.children.length, 1);
  assert.equal(map.customerRows.children[0].children[0].textContent, 'khach-b@example.com');
  map.search.value = 'khach-a'; map.search.dispatch('input');
  assert.equal(map.customerRows.children.length, 0);
  assert.equal(map.customerEmpty.hidden, false);
  map.clearFilters.dispatch('click');
  assert.equal(map.customerRows.children.length, 5);
  assert.equal(map.search.value, '');
  assert.equal(map.search.focused, true);
  map.sort.value = 'reverseEmail'; map.sort.dispatch('change');
  assert.equal(map.customerRows.children[0].children[0].textContent, 'khach-e@example.com');
});

test('opening customer detail shows separate license and device fields', () => {
  const { map } = launch();
  const row = map.customerRows.children.find(r => r.children[0].textContent === 'khach-b@example.com');
  row.children.at(-1).children[0].dispatch('click');
  assert.equal(map.detail.hidden, false);
  assert.equal(map.customers.hidden, true);
  assert.equal(map.detailTitle.textContent, 'khach-b@example.com');
  assert.match(map.detailLicense.textContent, /Sắp hết hạn/);
  assert.match(map.detailDevices.textContent, /Máy tính mẫu B/);
  map.back.dispatch('click');
  assert.equal(map.customers.hidden, false);
});

test('role simulator hides all admin content for customer and restores owner view', () => {
  const { map } = launch();
  map.demoRole.value = 'customer'; map.demoRole.dispatch('change');
  assert.equal(map.adminShell.hidden, true);
  assert.equal(map.accessDenied.hidden, false);
  map.demoRole.value = 'admin2'; map.demoRole.dispatch('change');
  assert.equal(map.adminShell.hidden, false);
  assert.equal(map.accessDenied.hidden, true);
  assert.equal(map.overview.hidden, false);
});

test('device rows expose mobile card labels and preserve mock-only values', () => {
  const { map } = launch();
  assert.equal(map.deviceRows.children.length, 4);
  const cells = map.deviceRows.children[0].children;
  assert.deepEqual(Array.from(cells, cell => cell.dataset.label),
    ['Thiết bị', 'Tài khoản', 'Lần hoạt động', 'Trạng thái']);
  assert.equal(cells[0].textContent, 'iPhone mẫu A');
  assert.equal(cells[2].textContent, 'Giả lập');
  assert.match(html, /#customers table,#devices table\{min-width:0\}/);
  assert.match(html, /#customerRows tr,#deviceRows tr\{display:block/);
});

test('mock command simulator rejects wrong confirmation then logs Admin 2 action', () => {
  const { map } = launch();
  map.demoRole.value = 'admin2'; map.demoRole.dispatch('change');
  const first = map.customerRows.children.find(row => row.children[0].textContent === 'khach-a@example.com');
  first.children.at(-1).children[0].dispatch('click');
  map.openSimulator.dispatch('click');
  assert.equal(map.mockCommandPanel.hidden, false);
  map.mockAction.value = 'pause'; map.mockAction.dispatch('change');
  assert.equal(map.mockDaysWrap.hidden, true);
  map.mockReason.value = 'Tạm dừng theo yêu cầu khách hàng';
  map.mockConfirm.value = 'wrong@example.com';
  map.mockCommandForm.dispatch('submit');
  assert.match(map.mockCommandMessage.textContent, /Email xác nhận không đúng/);
  assert.equal(map.mockHistory.children.length, 0);
  map.mockConfirm.value = 'khach-a@example.com';
  map.mockCommandForm.dispatch('submit');
  assert.equal(map.mockHistory.children.length, 1);
  assert.match(map.mockHistory.children[0].textContent, /Admin 2 · pause/);
  assert.match(map.detailLicense.textContent, /Tạm ngưng/);
});

test('mock device reset changes only in-memory fixture and rebuilds device cards', () => {
  const { map } = launch();
  const row = map.customerRows.children.find(r => r.children[0].textContent === 'khach-b@example.com');
  row.children.at(-1).children[0].dispatch('click');
  map.openSimulator.dispatch('click');
  map.mockAction.value = 'reset_device';
  map.mockReason.value = 'Khách đổi sang thiết bị mới';
  map.mockConfirm.value = 'khach-b@example.com';
  map.mockCommandForm.dispatch('submit');
  assert.equal(map.deviceRows.children.length, 3);
  assert.match(map.detailDevices.textContent, /Chưa có thiết bị/);
  assert.equal(map.statDevices.textContent, 3);
  assert.equal(map.mockHistory.children.length, 1);
});

test('customer simulator cannot commit any mock action after role change', () => {
  const { map } = launch();
  const row = map.customerRows.children[0];
  row.children.at(-1).children[0].dispatch('click');
  map.openSimulator.dispatch('click');
  map.demoRole.value = 'customer'; map.demoRole.dispatch('change');
  assert.equal(map.adminShell.hidden, true);
  assert.equal(map.mockCommandPanel.hidden, true);
  assert.equal(map.mockConfirm.value, '');
  map.mockCommandForm.dispatch('submit');
  assert.equal(map.mockHistory.children.length, 0);
});
