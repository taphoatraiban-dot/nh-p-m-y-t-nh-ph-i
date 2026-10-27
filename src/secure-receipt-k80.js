/* K80 receipt layout. QR pixels MUST be supplied by a trusted signing server.
   This module never generates or signs a verification token in the browser. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TSHSecureReceiptK80=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const WIDTH=576, PAD=20, MAX_LINES=40, MAX_HEIGHT=14000;
  const money=n=>Number(n).toLocaleString('vi-VN')+'đ';
  function wrap(value,limit){
    const result=[];
    for(const paragraph of String(value).split(/\r?\n/)){
      if(!paragraph){result.push('');continue;}
      for(let i=0;i<paragraph.length;i+=limit)result.push(paragraph.slice(i,i+limit));
    }
    return result;
  }
  function validate(record,qrImage){
    if(!record||!Array.isArray(record.lines)||!record.lines.length||record.lines.length>MAX_LINES)throw Error('Phơi ký số không hợp lệ.');
    if(!/^[0-9a-f-]{36}$/i.test(String(record.id||'')))throw Error('Thiếu mã phiếu do máy chủ phát hành.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(record.drawDate||''))||!String(record.customer||'').trim()||String(record.customer).length>80)throw Error('Ngày phiếu hoặc tên khách không hợp lệ.');
    const total=record.lines.reduce((sum,row)=>{
      if(!row||!String(row.station||'').trim()||String(row.station).length>18||!String(row.bet||'').trim()||String(row.bet).length>600||!Number.isSafeInteger(row.amount)||row.amount<0)throw Error('Dòng phơi hoặc tiền thu không hợp lệ.');
      return sum+row.amount;
    },0);
    if(!Number.isSafeInteger(total)||total!==record.total)throw Error('Tổng tiền thu không khớp bản gốc.');
    if(!qrImage||!qrImage.complete||!qrImage.naturalWidth)throw Error('Chưa có ảnh QR được máy chủ ký.');
    return total;
  }
  function render(record,qrImage,doc){
    validate(record,qrImage);
    const d=doc||(typeof document!=='undefined'?document:null);
    if(!d)throw Error('Không có trình duyệt để tạo phiếu.');
    const rows=record.lines.map(row=>({station:wrap(row.station,8),bet:wrap(row.bet,28),amount:money(row.amount)}));
    const heights=rows.map(row=>Math.max(45,Math.max(row.station.length,row.bet.length)*27+18));
    const height=300+heights.reduce((a,b)=>a+b,0)+275;
    if(height>MAX_HEIGHT)throw Error('Phiếu quá dài, cần tách thành phiếu nhỏ.');
    const canvas=d.createElement('canvas');canvas.width=WIDTH;canvas.height=height;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Không tạo được ảnh phiếu.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,WIDTH,height);
    ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.textBaseline='top';
    const text=(s,x,y,size=20,bold=false)=>{ctx.font=(bold?'bold ':'')+size+'px monospace';ctx.fillText(String(s),x,y)};
    let y=PAD;
    ctx.strokeRect(PAD,y,WIDTH-PAD*2,46);text('PHIẾU MUA HÀNG',WIDTH/2-121,y+11,25,true);y+=46;
    ctx.strokeRect(PAD,y,WIDTH-PAD*2,65);
    text('NGÀY: '+String(record.drawDate||'').slice(0,10),PAD+10,y+8,19);
    text('KHÁCH: '+String(record.customer||'').slice(0,38),PAD+10,y+36,19);y+=65;
    const x1=PAD+104,x2=WIDTH-PAD-132;
    ctx.strokeRect(PAD,y,WIDTH-PAD*2,36);ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x1,y+36);ctx.moveTo(x2,y);ctx.lineTo(x2,y+36);ctx.stroke();
    text('ĐÀI',PAD+8,y+8,19,true);text('NỘI DUNG',x1+8,y+8,19,true);text('TIỀN THU',x2+7,y+8,17,true);y+=36;
    rows.forEach((row,index)=>{
      const h=heights[index];ctx.strokeRect(PAD,y,WIDTH-PAD*2,h);
      ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x1,y+h);ctx.moveTo(x2,y);ctx.lineTo(x2,y+h);ctx.stroke();
      row.station.forEach((s,i)=>text(s,PAD+6,y+9+i*27,17));
      row.bet.forEach((s,i)=>text(s,x1+6,y+9+i*27,17));
      text(row.amount,x2+5,y+9,16,true);y+=h;
    });
    ctx.strokeRect(PAD,y,WIDTH-PAD*2,47);text('TỔNG TIỀN THU',PAD+9,y+12,20,true);text(money(record.total),x2+5,y+13,19,true);y+=47;
    const qrSize=210;ctx.drawImage(qrImage,Math.round((WIDTH-qrSize)/2),y+15,qrSize,qrSize);y+=225;
    text('MÃ: '+record.id.slice(0,8).toUpperCase(),WIDTH/2-84,y,18,true);y+=30;
    text('Đối chiếu bằng QR trên phiếu',PAD+67,y,17);
    return canvas;
  }
  async function share(record,qrImage,nav,doc,FileCtor){
    const n=nav||(typeof navigator!=='undefined'?navigator:null),F=FileCtor||(typeof File!=='undefined'?File:null);
    if(!n||!F||typeof n.share!=='function'||typeof n.canShare!=='function')throw Error('iPhone chưa hỗ trợ chia sẻ ảnh sang ứng dụng in.');
    const canvas=render(record,qrImage,doc);
    const data=canvas.toDataURL('image/png').split(',')[1];
    if(!data)throw Error('Không tạo được ảnh phiếu.');
    const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
    const file=new F([bytes],'phieu-mua-hang-qr-80mm.png',{type:'image/png'});
    if(!n.canShare({files:[file]}))throw Error('Trình duyệt không cho phép chia sẻ ảnh in.');
    await n.share({files:[file],title:'Phiếu mua hàng'});
    return {shared:true,printed:false}; // Share is not hardware print confirmation.
  }
  return {validate,render,share,wrap};
});
