import crypto from 'crypto';
import { makeSession } from '@/lib/admin';
import { tooMany, clientIp } from '@/lib/ratelimit';

export async function POST(req) {
  if (await tooMany(`login:${clientIp(req)}`, 6, 900))
    return Response.json({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }, { status: 429 });
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
