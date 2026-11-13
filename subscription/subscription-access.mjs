/** Pure, side-effect-free subscription access decisions.
 * Not a server authorization endpoint. Do not trust client-provided records.
 */
export const DEVICE_TRANSFER_LIMIT = 2;
export const DEVICE_TRANSFER_WINDOW_DAYS = 30;
const DAY_MS = 86400000;
function timestamp(value) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new RangeError('Invalid timestamp');
  return ms;
}
export function decideSubscriptionAccess({now, isAdmin=false, legacyValid=false, legacyLifetime=false, subscription=null, trialStartedAt=null}) {
  const time = timestamp(now);
  if (isAdmin) return {allowed:true,reason:'admin'};
  // Legacy entitlements remain authoritative until server migration is explicitly activated.
  if (legacyLifetime) return {allowed:true,reason:'legacy_lifetime'};
  if (legacyValid) return {allowed:true,reason:'legacy_license'};
  if (subscription?.status === 'active' && subscription?.expires_at &&
      timestamp(subscription.expires_at) > time) {
    return {allowed:true,reason:'paid',plan:subscription.plan_code};
  }
  if (trialStartedAt) {
    const start = timestamp(trialStartedAt);
    if (start <= time && time - start < 48 * 60 * 60 * 1000) {
      return {allowed:true,reason:'trial',plan:'WEB'};
    }
  }
  return {allowed:false,reason:'expired'};
}

/** Decide whether a user-initiated phone transfer is eligible.
 * Server must authenticate the user, serialize concurrent transfers,
 * and revoke prior sessions atomically. Admin recovery is a separate workflow.
 */
export function decidePhoneTransfer({now, transferTimes=[], samePhone=false, adminOverride=false}) {
  const time = timestamp(now);
  if (samePhone) return {allowed:true,reason:'same_phone'};
  if (adminOverride) return {allowed:true,reason:'admin_recovery'};
  const recent = transferTimes.filter(t => {
    const when = timestamp(t);
    return when <= time && time - when < DEVICE_TRANSFER_WINDOW_DAYS * DAY_MS;
  }).length;
  return recent >= DEVICE_TRANSFER_LIMIT
    ? {allowed:false,reason:'transfer_limit',recent}
    : {allowed:true,reason:'transfer_allowed',recent};
}
