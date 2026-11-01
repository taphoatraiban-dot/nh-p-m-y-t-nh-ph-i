/** Subscription catalog. Pure logic only; no license activation or DB writes. */
export const PRICE_VND = Object.freeze({
  WEB: Object.freeze({ 1: 799000, 3: 2290000, 6: 4390000, 12: 7990000 }),
  WEB_PRINT: Object.freeze({ 1: 1299000, 3: 3690000, 6: 6990000, 12: 12990000 }),
});
export const TRIAL_HOURS = 48;
export const MAX_CONCURRENT_PHONES = 1;
export const PRINT_AVAILABLE_FOR_SALE = false;

export function quoteSubscription(plan, months) {
  if (!Object.hasOwn(PRICE_VND, plan) ||
      !Object.hasOwn(PRICE_VND[plan], months)) {
    throw new RangeError('Invalid subscription plan or duration');
  }
  return Object.freeze({
    plan,
    months: Number(months),
    priceVnd: PRICE_VND[plan][months],
    canPurchase: plan === 'WEB' || PRINT_AVAILABLE_FOR_SALE,
  });
}

/** Calendar-month renewal in UTC, clamped to last day of target month. */
export function addCalendarMonths(isoDate, months) {
  if (!Number.isInteger(months) || ![1, 3, 6, 12].includes(months)) {
    throw new RangeError('Invalid months');
  }
  const d = new Date(isoDate);
  if (!Number.isFinite(d.getTime())) throw new RangeError('Invalid date');
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1,
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return target.toISOString();
}

export function calculateRenewalExpiry({ now, currentExpiry, months }) {
  const nowMs = new Date(now).getTime();
  const expiryMs = currentExpiry ? new Date(currentExpiry).getTime() : NaN;
  if (!Number.isFinite(nowMs)) throw new RangeError('Invalid now');
  const base = Number.isFinite(expiryMs) && expiryMs > nowMs ? currentExpiry : now;
  return addCalendarMonths(base, months);
}
