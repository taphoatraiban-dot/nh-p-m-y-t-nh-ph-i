import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

test('verify.html inline scripts parse without JavaScript syntax errors', () => {
  const html = readFileSync(new URL('../verify.html', import.meta.url), 'utf8');
  const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attributes, body]) => !/\bsrc\s*=/.test(attributes) && !/\btype\s*=\s*["']module["']/.test(attributes) && body.trim());
  assert.ok(inlineScripts.length > 0, 'Expected at least one inline script');
  inlineScripts.forEach(([, , code], i) => assert.doesNotThrow(() => new Script(code, { filename: 'verify.html:inline-' + i })));
});

test('verification page includes owner history and payment controls', () => {
  const html = readFileSync(new URL('../verify.html', import.meta.url), 'utf8');
  for (const id of ['ownerHistoryBtn', 'ownerHistoryTable', 'historyCsvBtn', 'historyNextBtn', 'paidAmountVnd', 'redeemBtn']) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing ' + id);
  }
});
