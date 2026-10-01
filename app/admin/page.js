import { redirect } from 'next/navigation';
import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import Actions from './Actions';

export const dynamic = 'force-dynamic';

const TZ = '-05:00';
const today = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const shift = (d, n) => new Date(+new Date(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const hm = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });
const LABEL = { confirmed: 'Confirmada', completed: 'Completada', cancelled: 'Cancelada', no_show: 'No asistió' };

export default async function Admin({ searchParams }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date || '') ? sp.date : today();

  const { data } = await db.from('appointments')
    .select('id,starts_at,ends_at,status,price,early_fee,cancelled_late,services(name),stylists(name),clients(full_name,phone)')
    .gte('starts_at', `${date}T00:00:00${TZ}`).lte('starts_at', `${date}T23:59:59${TZ}`)
    .order('starts_at');
  const list = data || [];
  const active = list.filter((a) => a.status !== 'cancelled');
  const label = new Date(date + 'T12:00:00Z')
    .toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  return (
    <main>
      <h1>Agenda</h1>
      <div className="nav">
        <a href={`/admin?date=${shift(date, -1)}`}>← Anterior</a>
        <a href={`/admin?date=${today()}`}>Hoy</a>
        <a href={`/admin?date=${shift(date, 1)}`}>Siguiente →</a>
      </div>
      <h2>{label}</h2>
      <p className="note">{active.length} {active.length === 1 ? 'cita' : 'citas'}</p>
      {list.length === 0 && <p className="note">No hay citas este día.</p>}
      {list.map((a) => (
        <div className="appt" key={a.id} style={a.status === 'cancelled' ? { opacity: 0.55 } : undefined}>
          <div className="time">{hm(a.starts_at)} – {hm(a.ends_at)}</div>
          <div><strong>{a.services.name}</strong> · {a.stylists.name}</div>
          <div>
            {a.clients.full_name} · <a href={`https://wa.me/${a.clients.phone.replace(/\D/g, '')}`}>{a.clients.phone}</a>
          </div>
          <div className="note">
            ${a.price}{a.early_fee > 0 && ` + $${a.early_fee} horario temprano`} · {LABEL[a.status]}
            {a.cancelled_late && ' · cancelación tardía'}
          </div>
          {a.status === 'confirmed' && <Actions id={a.id} />}
        </div>
      ))}
    </main>
  );
}
