import { redirect } from 'next/navigation';
import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export default async function Clients({ searchParams }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const q = String((await searchParams).q || '').trim().replace(/[%,()*]/g, '');
  let query = db.from('clients').select('id,full_name,phone,email').order('full_name').limit(100);
  if (q) {
    const digits = q.replace(/\D/g, '');
    const parts = [`full_name.ilike.%${q}%`, `email.ilike.%${q}%`, `cedula.ilike.%${q}%`, `phone.ilike.%${q}%`];
    if (digits.length >= 7) parts.push(`phone.ilike.%${digits.slice(-9)}%`); // acepta 0993… o +593993…
    query = query.or(parts.join(','));
  }
  const [{ data }, { data: bd }] = await Promise.all([
    query,
    db.from('clients').select('id,full_name,birthday_month,birthday_day').not('birthday_month', 'is', null),
  ]);

  const now = Date.now() - 5 * 3600000;
  const week = Array.from({ length: 7 }, (_, i) => {
    const t = new Date(now + i * 864e5);
    return { i, m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  });
  const soon = (bd || [])
    .map((c) => ({ c, hit: week.find((w) => w.m === c.birthday_month && w.d === c.birthday_day) }))
    .filter((x) => x.hit).sort((a, b) => a.hit.i - b.hit.i);

  return (
    <main className="wide">
      <h1>Clientas</h1>
      {soon.length > 0 && (
        <p className="bday">🎂 Esta semana: {soon.map(({ c, hit }) =>
          `${c.full_name} (${hit.i === 0 ? 'hoy' : hit.i === 1 ? 'mañana' : `${hit.d} de ${MES[hit.m - 1]}`})`).join(', ')}</p>
      )}
      <form><input name="q" defaultValue={q} placeholder="Buscar por nombre, teléfono, correo o cédula" /></form>
      {(data || []).map((c) => (
        <a key={c.id} className="row" href={`/admin/clientas/${c.id}`}>
          <span>{c.full_name}{c.email && <small className="note"> · {c.email}</small>}</span><span>{c.phone}</span>
        </a>
      ))}
      {data?.length === 0 && <p className="note">No encontramos clientas con esa búsqueda.</p>}
    </main>
  );
}
