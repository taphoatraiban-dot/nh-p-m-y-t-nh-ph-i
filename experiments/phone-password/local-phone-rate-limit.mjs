// Server-only staging helper: rate-limit and protect registration/login endpoints.
// Caller MUST supply a persistent, atomic limiter in production; in-memory limiter is
// intentionally limited to single-process local tests.
export function createLocalPhoneRateLimiter({clock=()=>Date.now(),windowMs=15*60*1000,maxAttempts=5}={}){
 if(!Number.isSafeInteger(windowMs)||windowMs<=0||!Number.isSafeInteger(maxAttempts)||maxAttempts<=0)throw new TypeError('INVALID_LIMITS');
 const hits=new Map();
 return function check(key){
  if(typeof key!=='string'||!key||key.length>256)throw new TypeError('INVALID_RATE_KEY');
  const now=clock(),previous=hits.get(key);
  const item=previous&&now<previous.resetAt?previous:{count:0,resetAt:now+windowMs};
  item.count++;
  hits.set(key,item);
  return {allowed:item.count<=maxAttempts,retryAfterMs:item.count>maxAttempts?Math.max(0,item.resetAt-now):0};
 };
}
// Use a per-IP AND per-phone key, after normalizing phone.
// Do not use this local limiter for multi-instance production deployments.
