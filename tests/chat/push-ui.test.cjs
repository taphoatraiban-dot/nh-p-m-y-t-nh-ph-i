const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const code=fs.readFileSync(path.join(__dirname,'../../assets/telegram-chat/notifications.js'),'utf8'),tick=()=>new Promise(r=>setTimeout(r,10));
async function setup(){
 const d=new JSDOM('<details id="ottChat" open><summary>Chat</summary><div id="ottChatUnlocked"></div></details>',{url:'https://cuncun.icu',runScripts:'outside-only',pretendToBeVisual:true});const w=d.window,calls=[],preferences=[];
 Object.defineProperty(w,'isSecureContext',{value:true});w.PushManager=class{};w.Notification={permission:'granted',requestPermission:async()=> 'granted'};
 const sub={endpoint:'https://fcm.googleapis.com/test',toJSON:()=>({endpoint:'https://fcm.googleapis.com/test',keys:{}}),unsubscribe:async()=>calls.push({unsubscribe:true})};
 const reg={active:{scriptURL:'https://cuncun.icu/ott-notifications-sw.js',postMessage:(data,ports)=>{preferences.push(data);ports?.[0]?.peer.onmessage();}},pushManager:{getSubscription:async()=>sub}};
 Object.defineProperty(w.navigator,'serviceWorker',{value:{getRegistration:async()=>reg,register:async()=>reg,ready:Promise.resolve(reg),addEventListener(){}}});
 w.MessageChannel=class{constructor(){this.port1={onmessage:null,close(){}};this.port2={peer:this.port1};}};
 w.localStorage.setItem('ott_push_owner','user-a');w.sb={auth:{getSession:async()=>({data:{session:{access_token:'jwt',user:{id:'user-a'}}}}),onAuthStateChange(){}}};w.SUPABASE_URL='https://test';w.SUPABASE_PUBLISHABLE_KEY='public';
 w.fetch=async(url,args)=>{const action=url.split('action=')[1];calls.push({action,body:JSON.parse(args.body)});return{ok:true,json:async()=>({success:true,enabled:action!=='disable'})};};
 w.eval(code);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await tick();return{w,d,calls,preferences,button:w.document.getElementById('ottPushToggle')};
}
test('leaving the app keeps background notifications enabled',async()=>{const s=await setup();try{assert.equal(s.button.getAttribute('aria-pressed'),'true');s.w.dispatchEvent(new s.w.Event('pagehide'));assert.equal(s.preferences.at(-1).enabled,true);assert.equal(s.preferences.at(-1).foreground,false);assert(!s.calls.some(c=>c.action==='disable'));}finally{s.d.window.close();}});
test('explicit off disables server registration and unsubscribes only this device',async()=>{const s=await setup();try{s.button.click();await tick();assert(s.calls.some(c=>c.action==='disable'));assert(s.calls.some(c=>c.unsubscribe));assert.equal(s.button.getAttribute('aria-pressed'),'false');}finally{s.d.window.close();}});
