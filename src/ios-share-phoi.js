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
  function renderFourColumns(data,doc){
    const items=Array.isArray(data.items)?data.items:[];
    const W=WIDTH,L=PAD,R=WIDTH-PAD;
    const col=[L,L+157,L+281,L+379,R];
    const rowH=52,headerH=48,groupH=48;
    const sections=[];
    for(const item of items){
      const name=String(item.station||item.region||'KHÁC');
      let section=sections[sections.length-1];
      if(!section||section.name!==name){section={name,rows:[],total:0};sections.push(section);}
      section.rows.push(item);
      const raw=String(item.amount||'').replace(/[^0-9,.-]/g,'').replace(/[.,](?=\d{3}(?:\D|$))/g,'').replace(',','.');
      section.total+=Number(raw)||0;
    }
    const qrSize=Array.isArray(data.qrMatrix)&&data.qrMatrix.length>=21?Math.floor(240/data.qrMatrix.length)*data.qrMatrix.length:0;
    // 80 mm paper at 203 dpi: ~80 dots = 10 mm after the QR caption.
    const height=205+sections.reduce((n,g)=>n+groupH+headerH+(g.rows.length+1)*rowH,0)+135+(qrSize?qrSize+30:0)+82;
    if(height>MAX_HEIGHT)throw Error('Phiếu quá dài để in một lần.');
    const canvas=doc.createElement('canvas');canvas.width=W;canvas.height=height;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,height);ctx.fillStyle='#000';
    ctx.textBaseline='middle';
    const txt=(v,x,y,size=23,align='center',maxWidth=0)=>{ctx.font='bold '+size+'px sans-serif';ctx.textAlign=align;ctx.fillText(String(v??''),x,y,maxWidth||undefined);};
    const ln=(x,y,xx,yy)=>{ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke();};
    ctx.lineWidth=2.5;
    txt(data.title||'PHIẾU MUA HÀNG',W/2,65,36);
    txt('NGÀY: '+(data.date||'')+' '+(data.time||''),L,119,23,'left');
    txt('KHÁCH: '+(data.customer||''),L,159,23,'left',R-L);
    let y=205;
    const cells=(values,h)=>{
      ln(L,y,R,y);ln(L,y+h,R,y+h);
      col.forEach(x=>ln(x,y,x,y+h));
      values.forEach((v,i)=>txt(v,(col[i]+col[i+1])/2,y+h/2,i===3?22:23,'center',col[i+1]-col[i]-9));
      y+=h;
    };
    sections.forEach(g=>{
      ctx.fillStyle='#eee';ctx.fillRect(L,y,R-L,groupH);ctx.fillStyle='#000';
      ln(L,y,R,y);ln(L,y+groupH,R,y+groupH);ln(L,y,L,y+groupH);ln(R,y,R,y+groupH);
      txt(g.name,W/2,y+groupH/2,26,'center',R-L-12);y+=groupH;
      cells(['SỐ','LOẠI','ĐIỂM','TIỀN THU'],headerH);
      g.rows.forEach(item=>cells([item.number||item.content||'',item.type||'',item.points||'',item.amount||''],rowH));
      ln(L,y,R,y);ln(L,y+rowH,R,y+rowH);ln(L,y,L,y+rowH);ln(col[3],y,col[3],y+rowH);ln(R,y,R,y+rowH);
      txt('TỔNG ĐÀI',(L+col[3])/2,y+rowH/2,25);
      txt(Math.round(g.total).toLocaleString('vi-VN')+'k',(col[3]+R)/2,y+rowH/2,23);
      y+=rowH;
    });
    txt(data.totalLabel||'TỔNG THU',L,y+40,29,'left');
    txt(data.total||'',R,y+40,31,'right');y+=90;
    txt('MÃ PHIẾU: '+(data.code||''),W/2,y+17,19,'center',R-L-8);y+=45;
    const qr=data.qrMatrix;
    if(Array.isArray(qr)&&qr.length>=21&&qr.every(a=>Array.isArray(a)&&a.length===qr.length)){
      const unit=Math.max(1,Math.floor(240/qr.length)),size=unit*qr.length,x=Math.floor((W-size)/2);
      qr.forEach((row,ry)=>row.forEach((bit,rx)=>{if(bit)ctx.fillRect(x+rx*unit,y+ry*unit,unit,unit);}));
      txt('QUÉT QR ĐỂ XÁC THỰC PHIẾU',W/2,y+size+30,18);
    }
    return canvas;
  }
  function renderTable(data,doc){
    if(data.layout==='by-station-4col')return renderFourColumns(data,doc);
    const canvas=doc.createElement('canvas');
    canvas.width=WIDTH;
    const columns=[PAD,PAD+46,PAD+106,PAD+166,WIDTH-PAD-112,WIDTH-PAD];
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
    const heights=items.map(x=>Math.max(64,x.wrapped.length*32+22));
    const top=216, headerH=56, bottom=68;
    const qr=data.qrMatrix;
    const qrValid=Array.isArray(qr)&&qr.length>=21&&qr.length<=177&&qr.every(row=>Array.isArray(row)&&row.length===qr.length);
    const height=top+headerH+heights.reduce((a,b)=>a+b,0)+bottom+(qrValid?340:62);
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
    const headers=['STT','MIỀN','LOẠI','NỘI DUNG','TIỀN THU'];
    ctx.font='bold 17px sans-serif';ctx.textAlign='center';
    headers.forEach((h,i)=>ctx.fillText(h,(columns[i]+columns[i+1])/2,y+headerH/2));
    y+=headerH;
    items.forEach((item,i)=>{
      const h=heights[i];
      ctx.font='bold 18px sans-serif';ctx.textAlign='center';
      ctx.fillText(String(i+1),(columns[0]+columns[1])/2,y+23);
      ctx.fillText(String(item.region||''),(columns[1]+columns[2])/2,y+23);
      ctx.fillText(String(item.type||''),(columns[2]+columns[3])/2,y+23);
      ctx.font='bold 20px sans-serif';ctx.textAlign='left';
      ctx.save();ctx.beginPath();ctx.rect(columns[3]+4,y+2,columns[4]-columns[3]-8,h-4);ctx.clip();
      item.wrapped.forEach((t,j)=>ctx.fillText(t,columns[3]+5,y+22+j*32));
      ctx.restore();
      ctx.font='bold 21px sans-serif';ctx.textAlign='right';
      ctx.fillText(String(item.amount||''),columns[5]-5,y+24,columns[5]-columns[4]-8);
      y+=h;gridLine(y);
    });
    ctx.font='bold 29px sans-serif';ctx.textAlign='right';
    ctx.fillText(data.totalLabel||'TỔNG THU',columns[4]-8,y+bottom/2,columns[4]-columns[3]-8);
    ctx.fillText(String(data.total||''),columns[5]-5,y+bottom/2);
    gridLine(y+bottom);
    for(let i=0;i<columns.length;i++)line(columns[i],top,columns[i],y+bottom);
    y+=bottom;
    ctx.font='bold 21px sans-serif';ctx.textAlign='center';
    ctx.fillText('MÃ PHIẾU: '+(data.code||''),WIDTH/2,y+35);
    if(qrValid){
      const moduleSize=Math.floor(240/qr.length),qrSize=moduleSize*qr.length;
      const left=Math.floor((WIDTH-qrSize)/2),topQr=y+55;
      ctx.fillStyle='#fff';ctx.fillRect(left-12,topQr-12,qrSize+24,qrSize+24);
      ctx.fillStyle='#000';
      qr.forEach((row,ry)=>row.forEach((dark,rx)=>{if(dark)ctx.fillRect(left+rx*moduleSize,topQr+ry*moduleSize,moduleSize,moduleSize);}));
      ctx.font='bold 19px sans-serif';ctx.textAlign='center';
      ctx.fillText('QUÉT QR ĐỂ XÁC THỰC PHIẾU',WIDTH/2,topQr+qrSize+30);
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
