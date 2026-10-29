// Owner-only payout preview. Amounts are in thousands of VND.
// Never use this preview as authorization to redeem a receipt.
export function calculateQrPayout(rows, diagnostics, rates) {
  const fail=(reason,index,lines=[])=>({ready:false,reason,index,lines});
  if(!Array.isArray(rows)||!rates||typeof rates!=='object')return fail('missing_rows_or_rates');
  if(rows.length===0||rows.length>1000)return fail('invalid_row_count');
  const lines=[];
  for(let i=0;i<rows.length;i++){
    const row=rows[i]||{};
    if(row.hidden||row.nonWinning){lines.push({index:i,skipped:true,amount:0});continue;}
    const type=String(row.type||'').toUpperCase();
    const digits=['B2','BL2','DD','ĐẦU','ĐUÔI','DA'].includes(type)?2:
      ['B3','BL3','XC','XC-ĐẦU','XC-ĐUÔI'].includes(type)?3:
      ['B4','BL4'].includes(type)?4:0;
    if(!digits)return fail('unsupported_type',i,lines);
    if(!Array.isArray(row.numbers)||row.numbers.length===0||
       row.numbers.some(n=>typeof n!=='string'||!new RegExp('^[0-9]{'+digits+'}$').test(n)))
      return fail('invalid_numbers',i,lines);
    if(type==='DA'&&row.numbers.length<2)return fail('missing_da_pair',i,lines);
    const points=Number(row.points);
    if(!Number.isFinite(points)||points<=0)return fail('invalid_points',i,lines);
    let key;
    if(['B2','BL2'].includes(type))key='b2';
    else if(['B3','BL3'].includes(type))key='b3';
    else if(['B4','BL4'].includes(type))key='b4';
    else if(type.startsWith('XC'))key='xc';
    else if(['DD','ĐẦU','ĐUÔI'].includes(type))key='dd';
    else if(type==='DA')key=row.region==='B'?'daMB':
      (row.cross2||row.daMode==='cross'||row.crossProvinces?.length===2)?'da2':'dathang';
    // A snapshot can use nested payout rate objects; never substitute live rates.
    const frozen=rates.tra&&typeof rates.tra==='object'?rates.tra:
      rates.payout&&typeof rates.payout==='object'?rates.payout:rates;
    const rate=Number(frozen[key]);
    if(!Number.isFinite(rate)||rate<=0)return fail('missing_rate',i,lines);
    const d=diagnostics?.[i];
    if(!d?.supported||d.diagnosticOnly!==true)return fail('unverified_diagnostic',i,lines);
    if(type==='DA'&&typeof d.cross==='boolean'){
      const cross=!!(row.cross2||row.daMode==='cross'||row.crossProvinces?.length===2);
      if(d.cross!==cross)return fail('da_mode_mismatch',i,lines);
    }
    const entries=type==='DA'?d.pairs:d.matches;
    if(!Array.isArray(entries))return fail('missing_matches',i,lines);
    const counts=entries.map(x=>Number(type==='DA'?x.times:x.count));
    if(counts.some(x=>!Number.isSafeInteger(x)||x<0))return fail('invalid_match_count',i,lines);
    const units=counts.reduce((a,b)=>a+b,0);
    if(!Number.isSafeInteger(units))return fail('unsafe_match_units',i,lines);
    const amount=units*points*rate;
    if(!Number.isSafeInteger(Math.round(amount*1000)))return fail('invalid_amount',i,lines);
    lines.push({index:i,type,units,points,rate,amount});
  }
  const total=lines.reduce((a,b)=>a+b.amount,0);
  if(!Number.isSafeInteger(Math.round(total*1000)))return fail('unsafe_total',undefined,lines);
  return {ready:true,diagnosticOnly:true,lines,total};
}
