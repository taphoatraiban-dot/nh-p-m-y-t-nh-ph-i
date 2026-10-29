// Pure payout preview for owner-only diagnostics. Amounts in thousands of VND.
// No automatic redemption: caller must verify result coverage, station and rate snapshot.
export function calculateQrPayout(rows, diagnostics, rates) {
  if (!Array.isArray(rows) || !rates || typeof rates !== 'object')
    return { ready:false, reason:'missing_rows_or_rates', lines:[] };
  if(rows.length===0)return {ready:false,reason:'no_bet_rows',lines:[]};
  if(rows.length>1000)return {ready:false,reason:'too_many_rows',lines:[]};
  const lines=[];
  for (let i=0;i<rows.length;i++) {
    const row=rows[i]||{};
    if(row.hidden||row.nonWinning){lines.push({index:i,skipped:true,amount:0});continue;}
    const type=String(row.type||'').toUpperCase();
    if(!Array.isArray(row.numbers)||row.numbers.length===0)return {ready:false,reason:'missing_numbers',index:i,lines};
    const points=Number(row.points);
    if(!Number.isFinite(points)||points<=0)return {ready:false,reason:'invalid_points',index:i,lines};
    let key;
    if(['B2','BL2'].includes(type))key='b2';
    else if(['B3','BL3'].includes(type))key='b3';
    else if(['B4','BL4'].includes(type))key='b4';
    else if(['XC','XC-ĐẦU','XC-ĐUÔI'].includes(type))key='xc';
    else if(['DD','ĐẦU','ĐUÔI'].includes(type))key='dd';
    else if(type==='DA')key=row.region==='B'?'daMB':(row.cross2||row.daMode==='cross'||row.crossProvinces?.length===2)?'da2':'dathang';
    if(type==='DA'&&row.numbers.length<2)return {ready:false,reason:'missing_da_pair',index:i,lines};
    else return {ready:false,reason:'unsupported_type',index:i,lines};
    const rate=Number(rates[key]);
    if(!Number.isFinite(rate)||rate<=0)return {ready:false,reason:'missing_rate',index:i,lines};
    const d=diagnostics?.[i];
    if(!d?.supported||d.diagnosticOnly!==true)return {ready:false,reason:'unverified_diagnostic',index:i,lines};
    const entries=type==='DA'?d.pairs:d.matches;
    if(!Array.isArray(entries))return {ready:false,reason:'missing_matches',index:i,lines};
    const counts=entries.map(x=>Number(type==='DA'?x.times:x.count));
    if(counts.some(x=>!Number.isSafeInteger(x)||x<0))return {ready:false,reason:'invalid_match_count',index:i,lines};
    const units=counts.reduce((a,b)=>a+b,0);
    if(!Number.isSafeInteger(units))return {ready:false,reason:'unsafe_match_units',index:i,lines};
    const amount=units*points*rate;
    if(!Number.isSafeInteger(Math.round(amount*1000)))return {ready:false,reason:'invalid_amount',index:i,lines};
    lines.push({index:i,type,units,points,rate,amount});
  }
  const total=lines.reduce((a,b)=>a+b.amount,0);
  if(!Number.isSafeInteger(Math.round(total*1000)))return {ready:false,reason:'unsafe_total',lines};
  return {ready:true,diagnosticOnly:true,lines,total};
}
