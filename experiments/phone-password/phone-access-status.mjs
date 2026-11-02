import { evaluatePhoneAccess } from './access-policy.mjs';

export async function phoneAccessStatus({ auth, token, findGrant, now = new Date() }) {
  try {
    const identity = await auth.authenticate(token);
    if (!identity) return { allowed: false, reason: 'UNAUTHENTICATED' };
    const grant = await findGrant(identity.accountId);
    return evaluatePhoneAccess({ identity, grant, now });
  } catch {
    return { allowed: false, reason: 'UNAVAILABLE' };
  }
}
