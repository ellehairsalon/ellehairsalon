import { redirect } from 'next/navigation';
import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import DayView from './DayView';
import NewAppt from './NewAppt';

export const dynamic = 'force-dynamic';

const TZ = '-05:00';
const today = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const shift = (d, n) => new Date(+new Date(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export default async function Admin({ searchParams }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date || '') ? sp.date : today();
  const [m, d] = [+date.slice(5, 7), +date.slice(8, 10)];

  const [{ data }, { data: bdays }] = await Promise.all([
    db.from('appointments')
      .select('id,client_id,starts_at,ends_at,status,price,early_fee,notes,checked_in_at,started_at,services(name,service_categories(name)),stylists(name),clients(full_name,phone)')
      .gte('starts_at', `${date}T00:00:00${TZ}`).lte('starts_at', `${date}T23:59:59${TZ}`)
      .neq('status', 'cancelled').order('starts_at'),
    db.from('clients').select('id,full_name').eq('birthday_month', m).eq('birthday_day', d),
  ]);
  const label = new Date(date + 'T12:00:00Z')
    .toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

  return (
    <main className="wide">
      <div className="nav">
        <a href={`/admin?date=${shift(date, -1)}`}>‹ Anterior</a>
        <a href={`/admin?date=${today()}`}>Hoy</a>
        <a href={`/admin?date=${shift(date, 1)}`}>Siguiente ›</a>
      </div>
      <h1 className="cap">{label}</h1>
      {bdays?.length > 0 && <p className="bday">🎂 Cumpleaños: {bdays.map((b) => b.full_name).join(', ')}</p>}
      <DayView appts={data || []} isToday={date === today()} />
      <NewAppt />
    </main>
  );
}
