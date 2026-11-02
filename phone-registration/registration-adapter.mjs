import {normalizeVietnameseMobile,validateRegistrationPassword} from './validation.mjs';

/** Draft-only registration adapter. Requires a separately verified email identity.
 * Never creates an unverified phone-only account or changes an existing account.
 * Uses the supplied authenticated Supabase client and its existing email sign-up flow.
 */
export async function registerWithVerifiedEmailAndPhone(client,{email,phone,password,confirmPassword}) {
  if (!client?.auth || typeof client.auth.signUp !== 'function') throw new TypeError('Supabase Auth client required');
  if (typeof email !== 'string' || !/^[^\s@]+@gmail\.com$/i.test(email.trim())) throw new RangeError('Địa chỉ Gmail không hợp lệ');
  const normalizedPhone = normalizeVietnameseMobile(phone);
  validateRegistrationPassword(password);
  if (password !== confirmPassword) throw new RangeError('Hai mật khẩu không khớp');
  // Phone is an unverified contact attribute, never a login identifier or entitlement.
  const {error} = await client.auth.signUp({
    email:email.trim().toLowerCase(),
    password,
    options:{data:{phone_contact_unverified:normalizedPhone}}
  });
  if(error) throw new Error(error.message || 'Đăng ký thất bại');
  // Supabase may intentionally return an obfuscated user for an existing email.
  // Never claim a new account was created or that phone ownership was established.
  return {emailConfirmationRequired:true,phoneVerified:false,licenseGranted:false,registrationRequestAccepted:true};
}
