'use strict';

// Local preview of the owner's approved renewal rule.
// The authoritative calculation must be repeated atomically on the server,
// using server time and the locked current license expiry.
const DAY_MS = 24 * 60 * 60 * 1000;

function calculateRenewedExpiry({ expiresAt = null, days, now } = {}) {
  if (!Number.isSafeInteger(days) || days < 1 || days > 365) {
    throw new RangeError('Gia hạn phải từ 1 đến 365 ngày.');
  }
  const current = now instanceof Date ? now.getTime() : NaN;
  if (!Number.isFinite(current)) throw new TypeError('Thời điểm thực hiện không hợp lệ.');
  let old = null;
  if (expiresAt !== null && expiresAt !== undefined) {
    if (typeof expiresAt !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(expiresAt)) {
      throw new TypeError('Hạn hiện tại phải có múi giờ rõ ràng.');
    }
    old = Date.parse(expiresAt);
    if (!Number.isFinite(old)) throw new TypeError('Hạn hiện tại không hợp lệ.');
  }
  const base = old === null ? current : Math.max(old, current);
  const expiry = base + days * DAY_MS;
  if (!Number.isFinite(expiry) || expiry > 8.64e15) throw new RangeError('Hạn mới vượt giới hạn thời gian.');
  return new Date(expiry).toISOString();
}

module.exports = { calculateRenewedExpiry };
