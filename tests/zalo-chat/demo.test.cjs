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
 assert.match(launcher,/timeoutId=window\.setTimeout\(stop,15000\)/);assert.match(launcher,/window\.clearTimeout\(timeoutId\)/);
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

test('demo search and navigation affordances',()=>{
 assert.match(demo,/Không tìm thấy hội thoại mẫu/);
 assert.match(demo,/event\.key==='Escape'/);
 assert.match(demo,/\$\('search'\)\.focus\(\)/);
});

test('searching resets active conversation and message selection',()=>{
 assert.match(demo,/\$\('search'\)\.oninput=\(\)=>\{if\(current!==null\)\{current=null;selected\.clear\(\);selecting=false/);
});

test('launcher is registered only once and follows Telegram assets',()=>{
 const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.equal(index.match(/assets\/zalo-chat\/launcher\.js/g)?.length,1);
 assert.ok(index.indexOf('assets/zalo-chat/launcher.js')>index.indexOf('assets/telegram-chat/chat.'));
});

test('mobile demo constrains height and scrolls messages independently',()=>{
 assert.match(demo,/\.app\{height:100dvh;min-height:0;overflow:hidden\}/);
 assert.match(demo,/\.messages\{min-height:0;overflow-y:auto;overscroll-behavior:contain\}/);
 assert.match(launcher,/frame\.style\.minHeight='0'/);
 assert.doesNotMatch(launcher,/frame\.style\.minHeight='540px'/);
});

test('clipboard access is opt-in and iframe remains origin isolated',()=>{
 assert.match(launcher,/frame\.setAttribute\('allow','clipboard-write'\)/);
 assert.match(launcher,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
 assert.doesNotMatch(launcher,/allow-same-origin|allow-top-navigation|allow-popups/);
 assert.match(demo,/navigator\.clipboard\?\.writeText/);
});

test('iPhone clipboard failure exposes selectable manual text without external calls',()=>{
 assert.match(demo,/manual\.id='manualCopy'/);
 assert.match(demo,/manual\.readOnly=true/);
 assert.match(demo,/manual\.value=text;manual\.focus\(\);manual\.select\(\)/);
 assert.match(demo,/Sao chép tự động bị chặn/);
});

test('manual copy text is cleared when thread is rerendered',()=>{
 assert.match(demo,/function clearManualCopy\(\)\{const field=\$\('manualCopy'\);if\(field\)field\.remove\(\)\}/);
 assert.match(demo,/function renderThread\(\)\{clearManualCopy\(\)/);
});

test('successful copy does not leave a stale manual copy box',()=>{
 assert.match(demo,/const text=selectedText\(\);if\(!text\)return;\s*clearManualCopy\(\);/);
 assert.match(demo,/await navigator\.clipboard\.writeText\(text\)/);
});

test('back and Escape navigation discard temporary manual copy text',()=>{
 assert.match(demo,/\$\('back'\)\.onclick=\(\)=>\{clearManualCopy\(\);app\.classList\.remove\('thread-open'\)/);
 assert.match(demo,/event\.key==='Escape'&&app\.classList\.contains\('thread-open'\)\)\{clearManualCopy\(\)/);
});

test('mobile safe-area footer and minimum touch targets',()=>{
 assert.match(demo,/env\(safe-area-inset-bottom\)/);
 assert.match(demo,/\.back,\.tools button,\.tabs button\{min-height:44px\}/);
});
