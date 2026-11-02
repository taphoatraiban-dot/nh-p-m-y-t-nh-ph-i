// Deny-by-default authorization policy for experimental phone identities.
// This policy is NOT a Supabase JWT and does not grant existing Cuncun RLS access.
// Explicit administrator approval must be recorded and verified server-side.
export function evaluatePhoneAccess({ identity, grant, now = new Date() } = {}) {
  if (!identity || identity.scope !== 'phone-auth-experiment-only' || !identity.accountId) {
    return { allowed:false, reason:'UNAUTHENTICATED' };
  }
  if (!grant || grant.account_id !== identity.accountId || grant.status !== 'approved') {
    return { allowed:false, reason:'PENDING_APPROVAL' };
  }
  if (grant.revoked_at) return { allowed:false, reason:'REVOKED' };
  if (grant.expires_at !== null && (!Number.isFinite(Date.parse(grant.expires_at)) ||
      new Date(grant.expires_at).getTime() <= new Date(now).getTime())) {
    return { allowed:false, reason:'EXPIRED' };
  }
  if (grant.expires_at === undefined) return { allowed:false, reason:'EXPIRED' };
  return { allowed:true, reason:'APPROVED_EXPERIMENT_ONLY' };
}
