import {normalizeVietnameseMobile,validateRegistrationPassword} from './validation.mjs';

/**
 * Experimental phone/password auth for a separate local/staging Supabase instance.
 * Requires phone signups enabled and phone confirmation DISABLED in that instance.
 * Never call against the production project. A phone is NOT ownership-verified.
 */
function requireSafeTestEnvironment(config,client) {
  // A caller-supplied environment label alone cannot prevent production access.
  // Require a local Auth URL and explicitly reject the known production project.
  const authUrl=client?.auth?.url ?? client?.authUrl ?? '';
  let host='';
  try { host=new URL(authUrl).hostname; } catch { /* invalid or missing */ }
  const localHost=host==='localhost'||host==='127.0.0.1'||host==='::1';
  if (!localHost || config?.environment !== 'local-test' || config?.phoneConfirmationDisabled !== true) {
    throw new Error('Chỉ chạy trong môi trường thử nghiệm đã tắt xác minh SMS');
  }
}
export async function registerPhonePassword(client, {phone,password,confirmPassword}, config) {
  requireSafeTestEnvironment(config,client);
  if (typeof client?.auth?.signUp !== 'function') throw new TypeError('Thiếu Supabase Auth');
  const normalizedPhone=normalizeVietnameseMobile(phone);
  validateRegistrationPassword(password);
  if(password!==confirmPassword) throw new RangeError('Hai mật khẩu không khớp');
  const {error}=await client.auth.signUp({phone:normalizedPhone,password});
  if(error) throw new Error('Không thể đăng ký. Vui lòng thử lại hoặc liên hệ quản trị viên.');
  return {registrationRequestAccepted:true,phoneVerified:false,licenseGranted:false};
}
export async function loginPhonePassword(client,{phone,password},config) {
  requireSafeTestEnvironment(config,client);
  if(typeof client?.auth?.signInWithPassword!=='function') throw new TypeError('Thiếu Supabase Auth');
  const normalizedPhone=normalizeVietnameseMobile(phone);
  if(typeof password!=='string'||!password) throw new RangeError('Thiếu mật khẩu');
  const {data,error}=await client.auth.signInWithPassword({phone:normalizedPhone,password});
  if(error||!data?.session) throw new Error('Số điện thoại hoặc mật khẩu không đúng');
  return {session:data.session,phoneVerified:false};
}
