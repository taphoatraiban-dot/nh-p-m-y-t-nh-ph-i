// Server-side admin approval domain logic; no public endpoints or Supabase privileges.
// Administrator identity must be verified independently by the existing admin auth.
export const ALLOWED_TERMS = Object.freeze(['1m','3m','12m','permanent']);
export function computeExpiry(term, from = new Date()) {
  if (!ALLOWED_TERMS.includes(term)) throw new TypeError('INVALID_TERM');
  const start = new Date(from);
  if (!Number.isFinite(start.getTime())) throw new TypeError('INVALID_DATE');
  if (term === 'permanent') return null;
  const months = Number.parseInt(term,10);
  const year = start.getUTCFullYear(), month = start.getUTCMonth(), day = start.getUTCDate();
  const target = new Date(Date.UTC(year,month+months,1,start.getUTCHours(),start.getUTCMinutes(),start.getUTCSeconds(),start.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
  target.setUTCDate(Math.min(day,lastDay));
  return target.toISOString();
}
export function authorizeAdminAction({admin, action}) {
  if (!admin || admin.authenticated !== true || admin.role !== 'owner' && admin.role !== 'admin')
    throw new Error('ADMIN_REQUIRED');
  if (!['approve','deny','revoke'].includes(action)) throw new TypeError('INVALID_ACTION');
  return true;
}
export function planGrantChange({admin,accountId,action,term,now=new Date(),previous}) {
  authorizeAdminAction({admin,action});
  if (typeof accountId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId)) throw new TypeError('INVALID_ACCOUNT');
  const base={account_id:accountId,approved_by:admin.id,updated_at:new Date(now).toISOString()};
  if (!admin.id || typeof admin.id !== 'string') throw new Error('ADMIN_REQUIRED');
  if (action==='deny') return {...base,status:'denied',expires_at:null,revoked_at:null};
  if (action==='revoke') return {...base,status:'denied',expires_at:previous?.expires_at??null,revoked_at:new Date(now).toISOString()};
  if (!ALLOWED_TERMS.includes(term)) throw new TypeError('INVALID_TERM');
  // A permanent grant uses NULL expiry; enforcement must explicitly distinguish it.
  if (term==='permanent') return {...base,status:'approved',expires_at:null,revoked_at:null};
  const prev=previous?.status==='approved' && previous?.expires_at && Date.parse(previous.expires_at)>new Date(now).getTime()?new Date(previous.expires_at):new Date(now);
  return {...base,status:'approved',expires_at:computeExpiry(term,prev),revoked_at:null};
}
