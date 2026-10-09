import { redirect } from 'next/navigation';
import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import Inbox from './Inbox';

export const dynamic = 'force-dynamic';

export default async function Pendientes() {
  if (!(await isAdmin())) redirect('/admin/login');
  const { data } = await db.from('appointments')
    .select('id,client_id,starts_at,ends_at,price,early_fee,created_at,manage_token,services(name),stylists(name),clients(full_name,phone,email)')
    .eq('status', 'pending').gte('starts_at', new Date().toISOString()).order('starts_at');
  return (
    <main className="wide">
      <h1>Por confirmar</h1>
      <p className="note">Solicitudes de clientas. Cada una ya aparta su horario en la agenda hasta que la respondas.</p>
      <Inbox items={data || []} />
    </main>
  );
}
