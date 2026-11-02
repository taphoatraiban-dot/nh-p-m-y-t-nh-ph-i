// READ-ONLY smoke test of real Supabase Auth. No admin grants or database writes.
// Run only on your own Mac; never paste tokens or keys into chat.
// Requires: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ACCESS_TOKEN.
// Validates the token against Auth's /user endpoint. This does NOT prove admin status.
const {SUPABASE_URL:base,SUPABASE_ANON_KEY:key,SUPABASE_ACCESS_TOKEN:token}=process.env;
if(!base||!key||!token)throw Error('MISSING_ENV: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ACCESS_TOKEN');
const url=new URL(base);
if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.username||url.password)throw Error('INVALID_SUPABASE_URL');
const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
try{
 const response=await fetch(new URL('/auth/v1/user',url),{headers:{apikey:key,Authorization:'Bearer '+token,Accept:'application/json'},signal:controller.signal});
 if(!response.ok){console.log('AUTH_VERIFICATION_FAILED HTTP',response.status);process.exitCode=1;}
 else{
  const user=await response.json();
  if(!user?.id)throw Error('INVALID_AUTH_RESPONSE');
  console.log('SUPABASE_AUTH_VALID: yes');
  console.log('USER_ID_SUFFIX:',String(user.id).slice(-6));
  console.log('ADMIN_MEMBERSHIP: not checked (requires trusted server-side admin_users query)');
  console.log('PRODUCTION_DATA_WRITES: none');
 }
}catch(error){console.error('AUTH_CHECK_ERROR:',error.name);process.exitCode=1}
finally{clearTimeout(timeout)}
