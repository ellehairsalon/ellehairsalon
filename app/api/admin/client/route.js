import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

export async function POST(req) {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const { id, birthday_month, birthday_day } = await req.json();
  const m = +birthday_month, d = +birthday_day;
  const ok = m >= 1 && m <= 12 && d >= 1 && d <= 31;
  const patch = ok ? { birthday_month: m, birthday_day: d } : { birthday_month: null, birthday_day: null };
  const { error } = await db.from('clients').update(patch).eq('id', id);
  return error ? Response.json({ error: 'No se pudo guardar' }, { status: 500 }) : Response.json({ ok: true });
}
