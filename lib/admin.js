import crypto from 'crypto';
import { cookies } from 'next/headers';

// Sesión firmada con la contraseña del panel (variable ADMIN_PASSWORD). Dura 7 días.
const sign = (exp) =>
  crypto.createHmac('sha256', process.env.ADMIN_PASSWORD || '').update('admin:' + exp).digest('hex');

export function makeSession() {
  const exp = Date.now() + 30 * 864e5;
  return `${exp}.${sign(exp)}`;
}

export async function isAdmin() {
  if (!process.env.ADMIN_PASSWORD) return false;
  const v = (await cookies()).get('admin')?.value || '';
  const [exp, sig] = v.split('.');
  if (!exp || !sig || +exp < Date.now()) return false;
  const good = Buffer.from(sign(exp)), got = Buffer.from(sig);
  return good.length === got.length && crypto.timingSafeEqual(good, got);
}
