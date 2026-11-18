'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const { join } = require('node:path');
const vm = require('node:vm');
const { parse } = require('./helpers/production-parser.cjs');

const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
const date = '2026-11-18';
function section(start, end) {
  const a = html.indexOf('function ' + start + '(');
  const b = html.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return html.slice(a, b);
}

const main = new vm.Script([
  section('normalizeDateKey', '\nfunction '),
  section('drawProvince', 'function renderScan('),
  section('priceForRow', 'function typeLabel('),
  section('mainDrawsForCross2', '</script>'),
  section('liveMergeRegion', 'function liveResultCounts('),
].join('\n'));

const sizes = { db: 1, g1: 1, g2: 1, g3: 2, g4: 7, g5: 1, g6: 3, g7: 1, g8: 1 };
function board(province, suffixes, day = date) {
  const prizes = Object.fromEntries(Object.entries(sizes).map(([key, size]) =>
    [key, Array(size).fill('99999')]));
  prizes.g4.splice(0, suffixes.length, ...suffixes.map(n => '123' + n));
  return { province, date: day, prizes };
}

function payout(rows, boards, extra = {}) {
  const lotteryResults = { N: [], T: [], B: [], [rows[0].region]: boards };
  const ctx = vm.createContext({
    $: () => ({ value: date }), rows, lotteryResults,
    price: { da2: 540, dathang: 700 }, ...extra,
  });
  main.runInContext(ctx);
  return ctx;
}

test('2dmt 6776da10 pays 10,800k on the main screen, using only the selected stations and date', () => {
  const { rows, errors } = parse('2dmt 6776da10', date);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.deepEqual(row.numbers, ['67', '76']);
  assert.equal(row.points, 10);
  assert.deepEqual(row.crossProvinces, ['Đà Nẵng', 'Khánh Hòa']);
  const ctx = payout(rows, [
    board('Đắk Lắk', ['67', '67', '76', '76']),
    board('Đà Nẵng', ['67', '76', '76']),
    board('Khánh Hòa', ['67']),
    board('Khánh Hòa', ['67', '76', '76'], '2026-11-15'),
  ]);
  const result = vm.runInContext('calcWinningAvailable(rows,price)', ctx);
  assert.equal(result.pendingCount, 0);
  assert.equal(result.wins, 10800);
  assert.equal(result.details[0].hits[0].pairCount, 2);
  assert.match(result.details[0].hits[0].detail, /67–76 ×2/);
});

test('ĐÁ MN three numbers produce three pairs per complete set', () => {
  const { rows, errors } = parse('2dmn 25.65.67da1', date);
  assert.deepEqual(errors, []);
  assert.deepEqual(rows[0].numbers, ['25', '65', '67']);
  const [a, b] = rows[0].crossProvinces;
  for (const [suffixes, amount] of [
    [[], 1620], [['25', '65', '67'], 3240], [['25', '65'], 2160],
  ]) {
    const ctx = payout(rows, [board(a, ['25', '65', '67']), board(b, suffixes)]);
    assert.equal(vm.runInContext('calcWinningAvailable(rows,price).wins', ctx), amount);
  }
});

for (const [slip, province, other] of [
  ['dnang 6776da10', 'Đà Nẵng', 'Khánh Hòa'],
  ['dnai 6776da10', 'Đồng Nai', 'Cần Thơ'],
]) {
  test(`${slip} uses the single-station rate and retains repeated prize slots across refreshes`, () => {
    const { rows, errors } = parse(slip, date);
    assert.deepEqual(errors, []);
    assert.equal(rows[0].daMode, 'straight');
    const draw = board(province, ['67', '67', '67', '76', '76']);
    draw.results = draw.prizes;
    const ctx = payout(rows, [draw, board(other, ['76', '76'])], { draw });
    const result = vm.runInContext(`
      lotteryResults[rows[0].region] = liveMergeRegion(lotteryResults[rows[0].region], [draw]);
      calcWinningAvailable(rows,price)
    `, ctx);
    assert.equal(result.pendingCount, 0);
    assert.equal(result.wins, 14000);
  });
}

test('the parser retains repeated identical plays as two paid rows', () => {
  const { rows, errors } = parse('2dmt 6776da10. 6776da10.', date);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 2);
  const [a, b] = rows[0].crossProvinces;
  const ctx = payout(rows, [board(a, ['67', '76']), board(b, ['67', '76'])]);
  assert.equal(vm.runInContext('calcWinning(rows,price).wins', ctx), 21600);
});
