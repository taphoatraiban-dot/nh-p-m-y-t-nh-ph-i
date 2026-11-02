/** Normalize Vietnamese mobile numbers for a future verified-identity flow.
 * This module does not create accounts, assert ownership, or touch Supabase.
 */
export function normalizeVietnameseMobile(input) {
  if (typeof input !== 'string') throw new TypeError('Số điện thoại phải là chuỗi');
  const trimmed = input.trim();
  if (!/^[+\d\s().-]+$/.test(trimmed)) throw new RangeError('Số điện thoại chứa ký tự không hợp lệ');
  const compact = trimmed.replace(/[\s().-]/g, '');
  const normalized = compact.startsWith('+84') ? '0' + compact.slice(3)
    : compact.startsWith('84') ? '0' + compact.slice(2) : compact;
  if (!/^0(?:3[2-9]|5[2689]|7[06789]|8[1-9]|9[0-9])\d{7}$/.test(normalized)) {
    throw new RangeError('Số di động Việt Nam không hợp lệ');
  }
  return '+84' + normalized.slice(1);
}
export function validateRegistrationPassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    throw new RangeError('Mật khẩu phải có từ 10 đến 128 ký tự');
  }
  return true;
}
