/* Share a rendered 80 mm receipt image to a user-selected iOS Bluetooth printer app.
   This does NOT connect to Bluetooth or assert that the chosen app printed the receipt. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TSHIOSSharePhoi=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const WIDTH=576, PAD=18, FONT=24, LINE=34, MAX_HEIGHT=14000;
  function wrap(text,maxChars=39){
    const lines=[];
    for(const raw of String(text||'').replace(/\r\n?/g,'\n').split('\n')){
      if(!raw.length){lines.push('');continue;}
      let rest=raw;
      while(rest.length>maxChars){
        let end=rest.lastIndexOf(' ',maxChars);
        if(end<Math.floor(maxChars/2))end=maxChars;
        lines.push(rest.slice(0,end));
        rest=rest.slice(end).replace(/^ +/,'');
      }
      lines.push(rest);
    }
    return lines;
  }
  function renderTable(data,doc){
    const canvas=doc.createElement('canvas');
    canvas.width=WIDTH;
    const columns=[PAD,PAD+46,PAD+112,PAD+188,WIDTH-PAD-94,WIDTH-PAD];
    const inner=columns[4]-columns[3]-10;
    const linesFor=(value)=>{
      const result=[];
      const ctx=doc.createElement('canvas').getContext('2d');
      ctx.font='bold 21px sans-serif';
      String(value||'').split('\n').forEach(part=>{
        let line='';
        for(const ch of part){
          if(line&&ctx.measureText(line+ch).width>inner){result.push(line);line=ch;}else line+=ch;
        }
        result.push(line);
      });
      return result;
    };
    const items=(data.items||[]).map(x=>({...x,wrapped:linesFor(x.content)}));
    const heights=items.map(x=>Math.max(56,x.wrapped.length*32+20));
    const top=216, headerH=56, bottom=68;
    const qr=data.qrMatrix;
    const hasQr=Array.isArray(qr)&&qr.length>=21&&qr.length<=177&&qr.every(row=>Array.isArray(row)&&row.length===qr.length&&row.every(bit=>bit===0||bit===1||bit===true||bit===false));
    const qrSize=hasQr?240:0;
    const height=top+headerH+heights.reduce((a,b)=>a+b,0)+bottom+62+(hasQr?qrSize+92:0);
    if(height>MAX_HEIGHT)throw Error('Phiếu quá dài để in một lần.');
    canvas.height=Math.max(200,height);
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,WIDTH,canvas.height);
    ctx.fillStyle='#000';ctx.textBaseline='middle';
    ctx.font='bold 38px sans-serif';ctx.textAlign='center';
    ctx.fillText(data.title||'PHIẾU MUA HÀNG',WIDTH/2,116);
    ctx.textAlign='left';ctx.font='bold 25px sans-serif';
    ctx.fillText('NGÀY: '+(data.date||'')+'  '+(data.time||''),PAD,165);
    ctx.fillText('KHÁCH: '+(data.customer||''),PAD,195);
    const line=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
    ctx.strokeStyle='#000';ctx.lineWidth=2.5;
    let y=top;
    const gridLine=(yy)=>line(PAD,yy,WIDTH-PAD,yy);
    gridLine(y);gridLine(y+headerH);
    const headers=['STT','MIỀN','LOẠI','NỘI DUNG','TIỀN'];
    ctx.font='bold 21px sans-serif';ctx.textAlign='center';
    headers.forEach((h,i)=>ctx.fillText(h,(columns[i]+columns[i+1])/2,y+headerH/2));
    y+=headerH;
    items.forEach((item,i)=>{
      const h=heights[i];
      ctx.font='bold 21px sans-serif';ctx.textAlign='center';
      ctx.fillText(String(i+1),(columns[0]+columns[1])/2,y+23);
      ctx.fillText(String(item.region||''),(columns[1]+columns[2])/2,y+23);
      ctx.fillText(String(item.type||''),(columns[2]+columns[3])/2,y+23);
      ctx.font='bold 23px sans-serif';ctx.textAlign='left';
      item.wrapped.forEach((t,j)=>ctx.fillText(t,columns[3]+5,y+20+j*32));
      ctx.font='bold 22px sans-serif';ctx.textAlign='right';
      ctx.fillText(String(item.amount||''),columns[5]-5,y+23);
      y+=h;gridLine(y);
    });
    ctx.font='bold 29px sans-serif';ctx.textAlign='right';
    ctx.fillText(data.totalLabel||'TỔNG THU',columns[4]-8,y+bottom/2);
    ctx.fillText(String(data.total||''),columns[5]-5,y+bottom/2);
    gridLine(y+bottom);
    for(let i=0;i<columns.length;i++)line(columns[i],top,columns[i],y+bottom);
    y+=bottom;
    ctx.font='bold 21px sans-serif';ctx.textAlign='center';
    ctx.fillText('MÃ PHIẾU: '+(data.code||''),WIDTH/2,y+35);
    if(hasQr){
      const n=qr.length,quiet=4,scale=qrSize/(n+quiet*2);
      const x0=(WIDTH-qrSize)/2,y0=y+62;
      ctx.fillStyle='#fff';ctx.fillRect(x0,y0,qrSize,qrSize);
      ctx.fillStyle='#000';
      for(let row=0;row<n;row++)for(let col=0;col<n;col++)if(qr[row][col]){
        const x1=Math.round(x0+(col+quiet)*scale),x2=Math.round(x0+(col+quiet+1)*scale);
        const y1=Math.round(y0+(row+quiet)*scale),y2=Math.round(y0+(row+quiet+1)*scale);
        ctx.fillRect(x1,y1,x2-x1,y2-y1);
      }
      ctx.font='bold 21px sans-serif';ctx.textAlign='center';
      ctx.fillText('QUÉT QR ĐỂ XÁC THỰC PHIẾU',WIDTH/2,y0+qrSize+27);
    }
    return canvas;
  }
  function render(text,doc){
    if(!String(text||'').trim())throw Error('Phơi đang trống.');
    if(String(text).startsWith('[[TABLE80]]'))return renderTable(JSON.parse(String(text).slice(11)),doc);
    const lines=wrap(String(text).replace(/^\[\[QR:[^\n]*\]\]$/gm,'').trimEnd());
    const height=Math.max(160,PAD*2+(lines.length+2)*LINE);
    if(height>MAX_HEIGHT)throw Error('Phơi quá dài để chia sẻ một ảnh. Hãy tách thành các phiếu nhỏ hơn.');
    const canvas=doc.createElement('canvas');canvas.width=WIDTH;canvas.height=height;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Không tạo được hình ảnh phơi.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,WIDTH,height);
    ctx.fillStyle='#000';ctx.font='bold '+FONT+'px monospace';ctx.textBaseline='top';
    lines.forEach((line,i)=>{
      const title=/PHIEU MUA HANG/i.test(line);
      const total=/^TONG (THU|BU):/i.test(line);
      ctx.font=(title?'bold 32px':total?'bold 29px':'bold '+FONT+'px')+' monospace';
      const text=line.trim();
      const x=title?Math.max(PAD,(WIDTH-ctx.measureText(text).width)/2):PAD;
      ctx.fillText(title?text:line,x,PAD+i*LINE);
    });
    return canvas;
  }
  function fileFromCanvas(canvas,fileCtor){
    const base64=canvas.toDataURL('image/png').split(',')[1];
    if(!base64)throw Error('Không xuất được ảnh phơi.');
    const bin=atob(base64),bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return new fileCtor([bytes],'phieu-mua-hang-80mm.png',{type:'image/png'});
  }
  function share(text,nav,doc,fileCtor){
    const n=nav||((typeof navigator!=='undefined')?navigator:null);
    const d=doc||((typeof document!=='undefined')?document:null);
    const F=fileCtor||((typeof File!=='undefined')?File:null);
    if(!n||!d||!F||typeof n.share!=='function'||typeof n.canShare!=='function')
      throw Error('Trình duyệt không hỗ trợ chia sẻ tệp. Hãy mở phần mềm bằng Safari trên iPhone để thử.');
    const image=fileFromCanvas(render(text,d),F);
    if(!n.canShare({files:[image]}))throw Error('Trình duyệt không cho phép chia sẻ ảnh phơi sang ứng dụng in.');
    // Called synchronously in the print button's user gesture.
    return n.share({files:[image],title:'Phiếu mua hàng 80 mm'}).then(()=>({ok:true,shared:true}));
  }
  return {wrap,render,share};
});
