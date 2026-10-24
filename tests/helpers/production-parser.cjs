'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// Execute the actual production parser and amount builder without booting the app.
// No network, credentials, storage or DOM event handlers are loaded.
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const start=html.indexOf('function groups(r)'),end=html.indexOf('function money(x)',start);
if(start<0||end<=start)throw Error('Production parser boundaries changed');
const expandStart=html.indexOf('function expand3DmnCrossDA(rows)'),expandEnd=html.indexOf('function scanRow(row)',expandStart);
if(expandStart<0||expandEnd<=expandStart)throw Error('Production expansion boundaries changed');
const source=html.slice(start,end)+html.slice(expandStart,expandEnd);
new vm.Script(source,{filename:'production-parser-from-index.js'});
function parse(raw,date='2026-10-24'){
 const elements={bets:{value:raw},date:{value:date}};
 const context=vm.createContext({$:id=>elements[id],document:{readyState:'loading',addEventListener(){},getElementById:id=>elements[id]}});
 vm.runInContext(source,context,{timeout:2000});
 const result=vm.runInContext('parseBets()',context,{timeout:2000});
 return JSON.parse(JSON.stringify(result));
}
module.exports={parse};
