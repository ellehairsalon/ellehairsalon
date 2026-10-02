import { redirect } from 'next/navigation';
import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const TZ = '-05:00';
const today = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const shift = (d, n) => new Date(+new Date(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const dayKey = (iso) => new Date(+new Date(iso) - 5 * 3600000).toISOString().slice(0, 10);
const hm = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });
const label = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });

export default async function Week({ searchParams }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const sp = await searchParams;
  const base = /^\d{4}-\d{2}-\d{2}$/.test(sp.date || '') ? sp.date : today();
  const start = shift(base, -((new Date(base + 'T12:00:00Z').getUTCDay() + 6) % 7)); // lunes
  const days = Array.from({ length: 7 }, (_, i) => shift(start, i));

  const [{ data }, { data: bd }] = await Promise.all([
    db.from('appointments').select('starts_at,clients(full_name),services(name)')
      .gte('starts_at', `${start}T00:00:00${TZ}`).lte('starts_at', `${days[6]}T23:59:59${TZ}`)
      .neq('status', 'cancelled').order('starts_at'),
    db.from('clients').select('full_name,birthday_month,birthday_day').not('birthday_month', 'is', null),
  ]);
  const by = {};
  (data || []).forEach((a) => { (by[dayKey(a.starts_at)] ||= []).push(a); });

  return (
    <main className="wide">
      <div className="nav">
        <a href={`/admin/semana?date=${shift(start, -7)}`}>‹ Semana anterior</a>
        <a href="/admin/semana">Esta semana</a>
        <a href={`/admin/semana?date=${shift(start, 7)}`}>Siguiente ›</a>
      </div>
      <h1>Semana</h1>
      {days.map((d) => {
        const list = by[d] || [];
        const cumple = (bd || []).filter((c) => c.birthday_month === +d.slice(5, 7) && c.birthday_day === +d.slice(8, 10));
        return (
          <a key={d} href={`/admin?date=${d}`} className="appt" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <strong className="cap">{label(d)}</strong>{d === today() && ' · hoy'}
            <div className="note">{list.length ? `${list.length} ${list.length === 1 ? 'cita' : 'citas'} · ${hm(list[0].starts_at)} a ${hm(list[list.length - 1].starts_at)}` : 'Libre'}</div>
            {list.slice(0, 3).map((a, i) => <div key={i}>{hm(a.starts_at)} · {a.clients.full_name} · {a.services.name}</div>)}
            {list.length > 3 && <div className="note">y {list.length - 3} más…</div>}
            {cumple.length > 0 && <div>🎂 {cumple.map((c) => c.full_name).join(', ')}</div>}
          </a>
        );
      })}
    </main>
  );
}
