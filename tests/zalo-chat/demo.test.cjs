const fs=require('node:fs'),assert=require('node:assert/strict'),test=require('node:test');
const path=require('node:path'),root=path.resolve(__dirname,'../..');
const launcher=fs.readFileSync(path.join(root,'assets/zalo-chat/launcher.js'),'utf8');
const demo=fs.readFileSync(path.join(root,'experiments/zalo-chat/index.html'),'utf8');
test('demo launcher is opt-in and sandboxed',()=>{assert.match(launcher,/addEventListener\('click'/);assert.match(launcher,/allow-scripts allow-forms/);assert.doesNotMatch(launcher,/allow-same-origin/);});
test('no Zalo account integration or external scripts',()=>{assert.doesNotMatch(demo,/<script[^>]+src=/i);assert.doesNotMatch(demo,/https?:\/\//);assert.match(demo,/Chưa kết nối/);assert.match(demo,/disabled>Gửi/);});
test('no Telegram endpoint use',()=>{assert.doesNotMatch(launcher+demo,/telegram-chat\?action|x-sync-key|service_role/i);});
