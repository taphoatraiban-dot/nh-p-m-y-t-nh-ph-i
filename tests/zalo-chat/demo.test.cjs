const fs=require('node:fs'),assert=require('node:assert/strict'),test=require('node:test');
const path=require('node:path'),root=path.resolve(__dirname,'../..');
const launcher=fs.readFileSync(path.join(root,'assets/zalo-chat/launcher.js'),'utf8');
const demo=fs.readFileSync(path.join(root,'experiments/zalo-chat/index.html'),'utf8');
test('demo launcher is opt-in and sandboxed',()=>{assert.match(launcher,/addEventListener\('click'/);assert.match(launcher,/setAttribute\('sandbox','allow-scripts'\)/);assert.doesNotMatch(launcher,/allow-forms/);assert.doesNotMatch(launcher,/allow-same-origin/);});
test('no Zalo account integration or external scripts',()=>{assert.doesNotMatch(demo,/<script[^>]+src=/i);assert.doesNotMatch(demo,/https?:\/\//);assert.match(demo,/Chưa kết nối/);assert.match(demo,/disabled>Gửi/);});
test('no Telegram endpoint use',()=>{assert.doesNotMatch(launcher+demo,/telegram-chat\?action|x-sync-key|service_role/i);});

test('CUNCUN index loads Zalo demo exactly once after Telegram chat',()=>{
 const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const zalo='assets/zalo-chat/launcher.js';
 const telegram='assets/telegram-chat/chat.';
 assert.equal(index.split(zalo).length-1,1,'Zalo demo script must appear once');
 assert.ok(index.indexOf(telegram)>=0,'Telegram chat must remain loaded');
 assert.ok(index.indexOf(zalo)>index.indexOf(telegram),'Zalo demo must follow Telegram chat');
});
test('demo does not auto-send or auto-print',()=>{
 assert.match(demo,/<button disabled>Gửi<\/button>/);
 assert.doesNotMatch(demo,/fetch\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage/);
 assert.doesNotMatch(launcher,/fetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
});

test('inline demo JavaScript parses without syntax errors',()=>{
 const vm=require('node:vm');
 const scripts=[...demo.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
 assert.ok(scripts.length>0,'demo must contain inline script');
 for(const script of scripts)assert.doesNotThrow(()=>new vm.Script(script[1]));
});
test('isolated demo cannot directly access CUNCUN bet input',()=>{
 assert.doesNotMatch(demo,/window\.parent\.document|parent\.document/);
 assert.match(demo,/id="import" disabled/);
});

test('switching chats and filters clears stale selection',()=>{
 assert.match(demo,/current=chat\.id;selected\.clear\(\);selecting=false;\$\('select'\)\.textContent='Chọn tin'/);
 assert.match(demo,/filter=b\.dataset\.filter;current=null;selected\.clear\(\);selecting=false/);
});
test('DOM observer has a bounded lifetime',()=>{
 assert.match(launcher,/setTimeout\(stop,15000\)/);
});

test('demo iframe closes when the page is left',()=>{
 assert.match(launcher,/addEventListener\('pagehide',close\)/);
});

test('deleting demo messages exits selection mode and shows an empty state',()=>{
 assert.match(demo,/c\.messages=c\.messages\.filter\(m=>!selected\.has\(m\.id\)\);selected\.clear\(\);selecting=false/);
 assert.match(demo,/Chưa có tin nhắn trong hội thoại mẫu/);
});
test('opening a demo conversation clears its unread badge',()=>{
 assert.match(demo,/chat\.unread=0;current=chat\.id/);
});
