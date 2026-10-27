/* Share a rendered 80 mm receipt image to a user-selected iOS Bluetooth printer app.
   This does NOT connect to Bluetooth or assert that the chosen app printed the receipt. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TSHIOSSharePhoi=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const WIDTH=576, PAD=22, FONT=22, LINE=30, MAX_HEIGHT=14000;
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
  function render(text,doc){
    if(!String(text||'').trim())throw Error('Phơi đang trống.');
    const lines=wrap(text);
    const height=Math.max(160,PAD*2+(lines.length+2)*LINE);
    if(height>MAX_HEIGHT)throw Error('Phơi quá dài để chia sẻ một ảnh. Hãy tách thành các phiếu nhỏ hơn.');
    const canvas=doc.createElement('canvas');canvas.width=WIDTH;canvas.height=height;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Không tạo được hình ảnh phơi.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,WIDTH,height);
    ctx.fillStyle='#000';ctx.font=FONT+'px monospace';ctx.textBaseline='top';
    lines.forEach((line,i)=>ctx.fillText(line,PAD,PAD+i*LINE));
    return canvas;
  }
  function fileFromCanvas(canvas,fileCtor){
    const base64=canvas.toDataURL('image/png').split(',')[1];
    if(!base64)throw Error('Không xuất được ảnh phơi.');
    const bin=atob(base64),bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return new fileCtor([bytes],'phoi-in-80mm.png',{type:'image/png'});
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
    return n.share({files:[image],title:'Phơi đề 80 mm'}).then(()=>({ok:true,shared:true}));
  }
  return {wrap,render,share};
});
