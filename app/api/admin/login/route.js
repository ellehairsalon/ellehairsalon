import crypto from 'crypto';
import { makeSession } from '@/lib/admin';

export async function POST(req) {
  const { password } = await req.json();
  const real = process.env.ADMIN_PASSWORD || '';
  const hash = (s) => crypto.createHash('sha256').update(String(s || '')).digest();
  if (!real || !crypto.timingSafeEqual(hash(password), hash(real)))
    return Response.json({ error: 'Contraseña incorrecta.' }, { status: 401 });
  const res = Response.json({ ok: true });
  res.headers.append('Set-Cookie',
    `admin=${makeSession()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 86400}`);
  return res;
}
