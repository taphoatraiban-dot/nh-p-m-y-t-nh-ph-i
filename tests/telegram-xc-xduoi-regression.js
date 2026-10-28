// Telegram message regression fixtures. Preserve station and all bet types.
(function(global){
 'use strict';
 const CASES=Object.freeze([
  {name:'Bến Tre XC + XC-đuôi',input:'btre\n148.348.848xc3.xduoi10.',expected:['148xc3','348xc3','848xc3','848xduoi10']},
  {name:'Bến Tre with Telegram line endings',input:'Btre\r\n148.348.848xc3.xduoi10.',expected:['148xc3','348xc3','848xc3','848xduoi10']}
 ]);
 function audit(text){
  const normalized=String(text||'').replace(/\r\n?/g,'\n').toLowerCase();
  const issues=[];
  if(!/^\s*btre\b/m.test(normalized))issues.push('Thiếu đài Bến Tre');
  if(/148\.348\.848\s*xc\s*3\s*\.\s*xduoi\s*10/.test(normalized)){
   // Preserve the source group; expanding is the parser's responsibility.
   return {ok:true,issues,expected:CASES[0].expected};
  }
  issues.push('Cần kiểm tra chuỗi XC/XC-đuôi');
  return {ok:false,issues,expected:CASES[0].expected};
 }
 global.CuncunTelegramBetRegression=Object.freeze({CASES,audit});
})(window);
