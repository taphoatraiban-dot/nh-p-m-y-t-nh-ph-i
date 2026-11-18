import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { calculateQrPayout } from '../qr-payout-preview.mjs';

const edge = readFileSync(new URL('../supabase/functions/receipt-verify/index.ts', import.meta.url), 'utf8');
const script = new vm.Script(stripTypeScriptTypes(edge.replace(/^import .*;$/m, '')));
const sizes = { db: 1, g1: 1, g2: 1, g3: 2, g4: 7, g5: 1, g6: 3, g7: 1, g8: 1 };
function board(province, suffixes) {
  const prizes = Object.fromEntries(Object.entries(sizes).map(([key, size]) =>
    [key, Array(size).fill('99999')]));
  prizes.g4.splice(0, suffixes.length, ...suffixes.map(n => '123' + n));
  prizes.metadata = ['67', '76'];
  return { province, prizes };
}

async function verify(region, row, boards) {
  const source = {
    rawText: 'ĐÁ', drawDate: '2026-11-18', pricedRows: [{ region, type: 'DA', ...row }],
    payoutRatesSnapshot: { da2: 540, dathang: 700 },
  };
  const receipt = { receipt_snapshot: { verificationSource: source } };
  const draw = { region: region === 'T' ? 'MT' : 'MN', data: { success: true, data: boards } };
  let handler;
  const db = {
    from(table) {
      const query = {
        select: () => query, eq: () => query,
        maybeSingle: async () => ({ data: receipt }),
        limit: async () => {
          assert.equal(table, 'lottery_results');
          return { data: [draw] };
        },
      };
      return query;
    },
  };
  script.runInNewContext({
    createClient: () => db, Deno: { env: { get() {} }, serve(fn) { handler = fn; } },
    crypto, TextEncoder, Response,
  });
  const response = await handler(new Request('https://example.test', {
    method: 'POST', body: JSON.stringify({ action: 'public-result', token: 'a'.repeat(64) }),
  }));
  assert.equal(response.status, 200);
  return response.json();
}

for (const [region, a, b, other] of [
  ['T', 'Đà Nẵng', 'Khánh Hòa', 'Đắk Lắk'],
  ['N', 'Đồng Nai', 'Cần Thơ', 'Sóc Trăng'],
]) {
  test(`QR ${region} uses the selected pair of stations even with legacy scopeStation`, async () => {
    const row = { cross2: true, scopeStation: a + ' + ' + b, crossProvinces: [a, b],
      numbers: ['67', '76'], points: 10 };
    const result = await verify(region, row, [
      board(other, ['67', '76']), board(a, ['67', '76', '76', '76']), board(b, ['67']),
    ]);
    assert.deepEqual(result.daDiagnostics[0].pairs, [{ a: '67', b: '76', times: 2 }]);
    assert.equal(calculateQrPayout(result.source.pricedRows, result.daDiagnostics, result.source.payoutRatesSnapshot).total, 10800);
    assert.deepEqual(result.stationCoverage[0].stations.map(s => s.matched), [a, b]);
    const single = await verify(region, { station: a, numbers: row.numbers, points: 10 }, [
      board(a, ['67', '67', '76', '76']), board(b, ['67', '76']),
    ]);
    assert.deepEqual(single.daDiagnostics[0].pairs, [{ a: '67', b: '76', times: 2 }]);
    assert.equal(calculateQrPayout(single.source.pricedRows, single.daDiagnostics, single.source.payoutRatesSnapshot).total, 14000);
  });
}

test('QR reports three pairs per set and rejects counting the same station twice', async () => {
  const a = 'Đồng Nai', b = 'Cần Thơ';
  const row = { cross2: true, crossProvinces: [a, b], numbers: ['25', '65', '67'], points: 1 };
  for (const times of [1, 2]) {
    const numbers = ['25', '65', '67'];
    const result = await verify('N', row, [board(a, numbers), board(b, times === 2 ? numbers : [])]);
    assert.equal(calculateQrPayout(result.source.pricedRows, result.daDiagnostics, result.source.payoutRatesSnapshot).total, 1620 * times);
    assert.deepEqual(result.daDiagnostics[0].pairs, [
      { a: '25', b: '65', times }, { a: '25', b: '67', times }, { a: '65', b: '67', times },
    ]);
  }
  const result = await verify('N', { ...row, crossProvinces: [a, a] }, [board(a, row.numbers)]);
  assert.equal(result.daDiagnostics[0].supported, false);
});
