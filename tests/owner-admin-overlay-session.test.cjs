'use strict';
// Fake-DOM execution of the branch-only preview module. No browser or network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '../src/owner-admin-center.js'), 'utf8');

function setup({ query = '?admin_preview=1', rpc = async () => ({ data: { success: true, is_admin: true }, error: null }) } = {}) {
  const elements = [];
  const listeners = new Map();
  const authListeners = [];
  let observer;
  let unlocked = false;
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.handlers = new Map(); this.hidden = false; this.removed = false; }
    append(...children) { this.children.push(...children); }
    remove() { this.removed = true; }
    focus() { this.focused = true; }
    addEventListener(name, fn) { this.handlers.set(name, fn); }
    click() { this.handlers.get('click')?.(); }
    setAttribute(name, value) { (this.attributes ||= {})[name] = value; }
  }
  const body = new Element('body');
  body.classList = { contains(name) { return name === 'app-unlocked' && unlocked; } };
  const head = new Element('head');
  const document = {
    body, head, hidden: false,
    createElement(tag) { const el = new Element(tag); elements.push(el); return el; },
    addEventListener(name, fn) { listeners.set(name, fn); }
  };
  const sb = { rpc, auth: { onAuthStateChange(callback) { authListeners.push(callback); } } };
  vm.runInNewContext(code, {
    document, location: { search: query }, URLSearchParams, sb,
    MutationObserver: class { constructor(fn) { observer = fn; } observe() {} },
    queueMicrotask, Date, console
  });
  return {
    elements, body, listeners,
    button() { return elements.find(el => el.id === 'ownerAdminPreviewOpen'); },
    overlay() { return elements.findLast(el => el.id === 'ownerAdminPreviewOverlay' && !el.removed); },
    setUnlocked(value) { unlocked = value; observer?.(); },
    emitAuth(event) { for (const callback of authListeners) callback(event, null); },
    emit(name, payload) { listeners.get(name)?.(payload); }
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('URL flag is required before the admin overlay is even installed', () => {
  const ui = setup({ query: '' });
  assert.equal(ui.button(), undefined);
  assert.equal(ui.elements.length, 0);
});

test('authorized Admin sees preview; locking closes and removes the iframe', async () => {
  const ui = setup();
  assert.equal(ui.button().hidden, true);
  ui.setUnlocked(true);
  await tick();
  assert.equal(ui.button().hidden, false);
  ui.button().click();
  const overlay = ui.overlay();
  assert.ok(overlay);
  assert.equal(overlay.children[1].tag, 'iframe');
  assert.equal(overlay.children[1].sandbox, 'allow-scripts');
  ui.setUnlocked(false);
  assert.equal(ui.button().hidden, true);
  assert.equal(overlay.removed, true);
  assert.equal(ui.overlay(), undefined);
  ui.button().click();
  assert.equal(ui.overlay(), undefined);
});

test('customer role and RPC failures never reveal preview', async () => {
  for (const rpc of [
    async () => ({ data: { success: true, is_admin: false }, error: null }),
    async () => ({ data: { success: true, is_admin: 'true' }, error: null }),
    async () => { throw new Error('offline'); }
  ]) {
    const ui = setup({ rpc });
    ui.setUnlocked(true);
    await tick();
    assert.equal(ui.button().hidden, true);
    ui.button().click();
    assert.equal(ui.overlay(), undefined);
  }
});

test('late response from prior login cannot reauthorize a newly unlocked customer', async () => {
  let completeOld;
  const old = new Promise(resolve => { completeOld = resolve; });
  let calls = 0;
  const ui = setup({ rpc: () => {
    calls += 1;
    return calls === 1 ? old : Promise.resolve({ data: { success: true, is_admin: false }, error: null });
  } });
  ui.setUnlocked(true);
  ui.setUnlocked(false);
  ui.setUnlocked(true);
  completeOld({ data: { success: true, is_admin: true }, error: null });
  await tick();
  await tick();
  assert.equal(calls, 2);
  assert.equal(ui.button().hidden, true);
  ui.button().click();
  assert.equal(ui.overlay(), undefined);
});

test('Escape dismisses open preview without changing permission state', async () => {
  const ui = setup();
  ui.setUnlocked(true);
  await tick();
  ui.button().click();
  assert.ok(ui.overlay());
  ui.emit('keydown', { key: 'Escape' });
  assert.equal(ui.overlay(), undefined);
  assert.equal(ui.button().hidden, false);
});

test('auth switch while app stays unlocked immediately closes Admin overlay', async () => {
  let admin = true;
  const ui = setup({ rpc: async () => ({ data: { success: true, is_admin: admin }, error: null }) });
  ui.setUnlocked(true);
  await tick();
  ui.button().click();
  const previousOverlay = ui.overlay();
  assert.ok(previousOverlay);
  admin = false;
  ui.emitAuth('SIGNED_IN'); // Different account, without a body class change.
  assert.equal(ui.button().hidden, true);
  assert.equal(previousOverlay.removed, true);
  await tick();
  assert.equal(ui.button().hidden, true);
  ui.button().click();
  assert.equal(ui.overlay(), undefined);
});

test('sign-out and token refresh both revoke cached Admin approval', async () => {
  let admin = true;
  const ui = setup({ rpc: async () => ({ data: { success: true, is_admin: admin }, error: null }) });
  ui.setUnlocked(true);
  await tick();
  assert.equal(ui.button().hidden, false);
  admin = false;
  ui.emitAuth('TOKEN_REFRESHED');
  assert.equal(ui.button().hidden, true);
  await tick();
  assert.equal(ui.button().hidden, true);
  ui.emitAuth('SIGNED_OUT');
  assert.equal(ui.button().hidden, true);
});
