import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import { normPhone, validEmail, validBirthday, validCedula } from '@/lib/validate';

const bad = (error, status = 400) => Response.json({ error }, { status });

// Búsqueda rápida para "nueva cita": clientes guardados por nombre o teléfono
export async function GET(req) {
  if (!(await isAdmin())) return bad('No autorizado', 401);
  const ph = new URL(req.url).searchParams.get('phone');
  if (ph) {
    const p = normPhone(ph);
    if (!p) return Response.json({ client: null });
    const { data } = await db.from('clients').select('id,full_name,phone').eq('phone', p).maybeSingle();
    return Response.json({ client: data || null });
  }
  const q = String(new URL(req.url).searchParams.get('q') || '').trim().replace(/[%,()*]/g, '');
  if (q.length < 2) return Response.json({ clients: [] });
  const digits = q.replace(/\D/g, '');
  const parts = [`full_name.ilike.%${q}%`];
  if (digits.length >= 4) parts.push(`phone.ilike.%${digits.slice(-9)}%`);
  const { data } = await db.from('clients').select('id,full_name,phone').or(parts.join(',')).order('full_name').limit(5);
  return Response.json({ clients: data || [] });
}

export async function POST(req) {
  if (!(await isAdmin())) return bad('No autorizado', 401);
  const b = await req.json();
  if (!b.id) return bad('Datos inválidos');

  const name = String(b.full_name || '').trim();
  if (name.length < 2) return bad('Escribe el nombre.');
  const phone = normPhone(b.phone);
  if (!phone) return bad('Revisa el WhatsApp.');
  const email = String(b.email || '').trim().toLowerCase();
  if (email && !validEmail(email)) return bad('Revisa el correo.');
  const ced = String(b.cedula || '').replace(/[\s.-]/g, '');
  if (/^\d{10}$/.test(ced) && !validCedula(ced)) return bad('Esa cédula no parece válida. Revísala.');

  const patch = {
    full_name: name.slice(0, 100), phone, email: email || null, cedula: ced.slice(0, 20) || null,
    internal_notes: String(b.internal_notes || '').slice(0, 2000) || null,
    birthday_month: null, birthday_day: null,
  };
  if (b.birthday_month || b.birthday_day) {
    const m = +b.birthday_month, d = +b.birthday_day;
    if (!validBirthday(m, d)) return bad('Revisa el cumpleaños (día y mes).');
    patch.birthday_month = m; patch.birthday_day = d;
  }

  const { error } = await db.from('clients').update(patch).eq('id', b.id);
  if (error) return error.code === '23505' ? bad('Ese WhatsApp ya pertenece a otro cliente.', 409) : bad('No se pudo guardar.', 500);
  return Response.json({ ok: true });
}
