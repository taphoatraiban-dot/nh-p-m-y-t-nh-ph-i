/** Admin-only quote and payment record preparation.
 * No auth changes, no DB writes, no device changes.
 */
import { quoteSubscription, calculateRenewalExpiry } from './subscription-catalog.mjs';

export function prepareManualRenewal({ userId, plan, months, now, currentExpiry = null, paymentReference = '' }) {
  if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new TypeError('Invalid user ID');
  }
  const quote = quoteSubscription(plan, months);
  if (!quote.canPurchase) throw new RangeError('Plan is not open for sale');
  if (typeof paymentReference !== 'string' || paymentReference.length > 120) throw new TypeError('Invalid payment reference');
  return Object.freeze({
    userId, plan: quote.plan, months: quote.months,
    amountVnd: quote.priceVnd,
    proposedExpiresAt: calculateRenewalExpiry({now,currentExpiry,months:quote.months}),
    paymentReference: paymentReference.trim(),
    paymentStatus: 'pending',
    licenseActivation: 'admin_confirmation_required',
  });
}
