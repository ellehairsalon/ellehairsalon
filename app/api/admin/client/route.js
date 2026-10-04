import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import { normPhone, validEmail, validBirthday, validCedula } from '@/lib/validate';

const bad = (error, status = 400) => Response.json({ error }, { status });

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
  if (error) return error.code === '23505' ? bad('Ese WhatsApp ya pertenece a otra clienta.', 409) : bad('No se pudo guardar.', 500);
  return Response.json({ ok: true });
}
