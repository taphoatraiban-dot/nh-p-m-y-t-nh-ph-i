const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const moduleSource=fs.readFileSync('assets/zalo-personal/manual-import.js','utf8');
const telegramSource=fs.readFileSync('assets/telegram-chat/chat.js','utf8');

test('Zalo manual module and Telegram loader parse',()=>{
 new vm.Script(moduleSource);new vm.Script(telegramSource);
});
test('Zalo integration is manual and has no Zalo credentials or network',()=>{
 assert.doesNotMatch(moduleSource,/fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|document\.cookie|zalo\.me\/api/i);
 assert.match(moduleSource,/Dán tin Zalo cá nhân \(thủ công\)/);
});
test('Review and consent gate transfer into the existing bets field',()=>{
 assert.match(moduleSource,/getElementById\('bets'\)/);
 assert.match(moduleSource,/check\.checked/);
 assert.match(moduleSource,/preview\.hidden/);
 assert.match(moduleSource,/dispatchEvent\(new global\.CustomEvent\('input'/);
 assert.match(moduleSource,/ottChatManualImport:true,zaloManualImport:true/);
 assert.doesNotMatch(moduleSource,/\.click\(\)|submit\s*\(/);
});
test('Existing content is never overwritten without confirmation',()=>{
 assert.match(moduleSource,/existing&&\!global\.confirm\(/);
 assert.match(moduleSource,/existing\?bets\.value\.replace/);
});
test('Telegram chat staging loader mounts the Zalo panel only once',()=>{
 assert.match(telegramSource,/getElementById\('cuncunZaloManualHost'\)/);
 assert.match(telegramSource,/assets\/zalo-personal\/manual-import\.js/);
 assert.match(telegramSource,/CuncunZaloManualImport\.mount\(\{host\}\)/);
 assert.match(telegramSource,/script\.onerror=/);
 assert.match(telegramSource,/catch\(err\)/);
});

test('Manual import refuses stale preview content',()=>{
 assert.match(moduleSource,/field\.value\.trim\(\)!==value/);
 assert.match(moduleSource,/Nội dung đã thay đổi, hãy xem trước và xác nhận lại/);
});
test('Price table selection remains in existing CUNCUN UI',()=>{
 assert.match(moduleSource,/Không tự chọn bảng giá/);
 assert.doesNotMatch(moduleSource,/getElementById\('priceTable'\)|\.selectedIndex\s*=/);
});

test('Locked CUNCUN cannot receive manually pasted Zalo bets',()=>{
 assert.match(moduleSource,/classList\.contains\('app-unlocked'\)/);
 assert.match(moduleSource,/CUNCUN đang khóa/);
});

test('Clear Zalo draft requires confirmation and does not edit CUNCUN bets',()=>{
 assert.match(moduleSource,/Xóa nội dung dán/);
 assert.match(moduleSource,/if\(!global\.confirm\('Xóa nội dung đang dán từ Zalo/);
 assert.match(moduleSource,/clipboardGeneration\+\+;field\.value='';reset\(\)/);
 assert.match(moduleSource,/Ô nhập phơi vẫn giữ nguyên/);
});
