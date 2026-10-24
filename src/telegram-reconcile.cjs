'use strict';
// Read-only preview only. Input must come from a validated parser, not raw chat.
// Does not authenticate callers: adapters MUST select only the signed-in user's data.
const SCALE = 1000000n;
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
const dimensions = ['user_id','date','region','station','bet_type','number','unit'];
const provenance = ['source','raw_text','message_date','received_at','parser_version','revision'];
const text = v => typeof v === 'string' && v.trim().length > 0 && v === v.trim();
function validDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === v;
}
function decimal(n) {
  const s = n.toString().padStart(7,'0');
  return (s.slice(0,-6) + '.' + s.slice(-6)).replace(/\.?0+$/, '') || '0';
}
function units(v) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
  const s = String(v);
  if (!/^\d+(\.\d{1,6})?$/.test(s)) return null;
  const [a,b=''] = s.split('.');
  const n = BigInt(a) * SCALE + BigInt(b.padEnd(6,'0'));
  return n <= MAX ? n : null;
}
function sourceOf(r) {
  const s = {chat_id:r.chat_id,message_id:r.message_id,line_id:r.line_id,amount:r.amount};
  for (const k of provenance) if (r[k] !== undefined) s[k] = r[k];
  return s;
}
function aggregate(input) {
  if (!Array.isArray(input)) throw new TypeError('Expected list');
  const identities = new Map(), totals = new Map(), unresolved = [], duplicates = [];
  for (const r of input) {
    if (!r || typeof r !== 'object' || !text(r.user_id) ||
        !Number.isSafeInteger(r.chat_id) || r.chat_id === 0 ||
        !Number.isSafeInteger(r.message_id) || r.message_id <= 0 ||
        !Number.isSafeInteger(r.line_id) || r.line_id < 0) {
      unresolved.push({id:null,reason:'source_identifiers_missing'}); continue;
    }
    const id = JSON.stringify([r.user_id,r.chat_id,r.message_id,r.line_id]);
    // Arrival time may differ on retry; content/revision changes must be reviewed.
    const signature = JSON.stringify([...dimensions.map(k=>r[k]),r.amount,r.validated,
      ...provenance.filter(k=>k!=='received_at').map(k=>r[k])]);
    const existing = identities.get(id);
    if (existing) {
      if (existing.signatures.has(signature)) duplicates.push(id);
      else { existing.signatures.add(signature); existing.conflict = true; }
    } else identities.set(id,{r,signatures:new Set([signature]),conflict:false});
  }
  let accepted = 0;
  for (const [id,item] of identities) {
    const r = item.r;
    if (item.conflict) { unresolved.push({id,reason:'source_conflict'}); continue; }
    const amount = units(r.amount);
    if (r.validated !== true || !['MN','MT','MB'].includes(r.region) || !validDate(r.date) ||
        !text(r.station) || !text(r.bet_type) || !text(r.number) ||
        !['point','vnd'].includes(r.unit) || amount === null ||
        provenance.some(k=>r[k]!==undefined && typeof r[k]!=='string')) {
      unresolved.push({id,reason:'requires_review'}); continue;
    }
    const key = JSON.stringify(dimensions.map(k=>r[k]));
    const row = totals.get(key) || {...Object.fromEntries(dimensions.map(k=>[k,r[k]])),scaled:0n,sources:[]};
    row.scaled += amount;
    row.sources.push(sourceOf(r));
    totals.set(key,row); accepted++;
  }
  const rows = [];
  for (const {scaled,...row} of totals.values()) {
    rows.push({...row,total:scaled<=MAX ? Number(scaled)/Number(SCALE) : null,
      total_decimal:decimal(scaled)});
  }
  return {rows,unresolved,duplicates,accepted};
}
// Totals by user/day/region/station/type/unit AND original source/chat.
// No currency conversion, pricing, winnings, or automatic reconciliation approval.
function reconcile(input) {
  const detail = aggregate(input), buckets = new Map();
  for (const row of detail.rows) for (const source of row.sources) {
    const fields = {...Object.fromEntries(dimensions.filter(k=>k!=='number').map(k=>[k,row[k]])),
      source:source.source || 'telegram',chat_id:source.chat_id};
    const key = JSON.stringify(Object.values(fields));
    const b = buckets.get(key) || {...fields,scaled:0n,line_count:0,messages:new Set()};
    b.scaled += units(source.amount); b.line_count++; b.messages.add(source.message_id);
    buckets.set(key,b);
  }
  const summary = [...buckets.values()].map(({scaled,messages,...b})=>({...b,
    message_count:messages.size,total:scaled<=MAX ? Number(scaled)/Number(SCALE) : null,total_decimal:decimal(scaled)}));
  return {...detail,summary,complete:detail.unresolved.length===0};
}
module.exports = {aggregate,reconcile};
