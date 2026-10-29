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

test('history paging and Vietnam-local date filtering keep expected safeguards', () => {
  const html = readFileSync(new URL('../verify.html', import.meta.url), 'utf8');
  assert.match(html, /historyAllRecords\.push\(/, 'Expected incremental history pagination');
  assert.match(html, /historyTable\.replaceChildren\(\);\s*const allRecords=historyAllRecords/, 'History table must clear before rebuilding to prevent duplicated rows');
  assert.match(html, /timeZone:'Asia\/Ho_Chi_Minh'/, 'History dates must use Vietnam time');
  assert.match(html, /if\(fromInput&&toInput&&fromInput>toInput\)throw Error/, 'Date range must be validated before requesting page');
  assert.match(html, /historyCsvBtn\.disabled=!records\.length/, 'CSV export must be disabled for empty results');
});

test('owner payment overview remains read-only until explicit redemption', () => {
  const html = readFileSync(new URL('../verify.html', import.meta.url), 'utf8');
  for(const id of ['ownerOpenBtn','ownerOpenMoreBtn','ownerOpenStatus','ownerOpenTable']) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing '+id);
  }
  assert.match(html, /call\('owner-open',jwt,\{page:openPage\}\)/);
  assert.match(html, /Đây không phải số tiền công nợ/);
});
