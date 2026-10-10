import { redirect } from 'next/navigation';
import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import Inbox from './Inbox';

export const dynamic = 'force-dynamic';

export default async function Pendientes() {
  if (!(await isAdmin())) redirect('/admin/login');
  const { data } = await db.from('appointments')
    .select('id,client_id,starts_at,ends_at,price,early_fee,client_note,created_at,group_id,guest_name,manage_token,services(name),stylists(name),clients(full_name,phone,email)')
    .eq('status', 'pending').gte('starts_at', new Date().toISOString()).order('starts_at');
  // Una reserva para varias personas aparece como una sola tarjeta
  const byKey = {};
  (data || []).forEach((r) => { (byKey[r.group_id || r.id] ||= []).push(r); });
  const groups = Object.values(byKey).map((rows) => {
    rows.sort((x, y) => +new Date(x.starts_at) - +new Date(y.starts_at));
    const main = rows.find((r) => !r.guest_name) || rows[0];
    return { ...main, starts_at: rows[0].starts_at, early_fee: rows.reduce((n, r) => n + +r.early_fee, 0), people: rows };
  }).sort((x, y) => +new Date(x.starts_at) - +new Date(y.starts_at));
  const { data: cfg } = await db.from('salon_settings').select('reschedule_min_hours').eq('id', 1).single();
  return (
    <main className="wide">
      <h1>Por confirmar</h1>
      <p className="note">Solicitudes de clientas. Cada una ya aparta su horario en la agenda hasta que la respondas.</p>
      <Inbox items={groups} hours={cfg?.reschedule_min_hours ?? 10} />
    </main>
  );
}
