// Content-addressed files prevent reuse of an older Safari/WebView asset URL.
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=path.join(__dirname,'..'),dir=path.join(root,'assets/telegram-chat');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const ext of ['js','css']){
 const content=fs.readFileSync(path.join(dir,'chat.'+ext));
 const hash=crypto.createHash('sha256').update(content).digest('hex').slice(0,12),name='chat.'+hash+'.'+ext;
 fs.writeFileSync(path.join(dir,name),content);
 html=html.replace(new RegExp('assets/telegram-chat/chat(?:\\.[a-f0-9]{12})?\\.'+ext+'(?:\\?[^"\\s]*)?','g'),'assets/telegram-chat/'+name);
}
fs.writeFileSync(path.join(root,'index.html'),html);
