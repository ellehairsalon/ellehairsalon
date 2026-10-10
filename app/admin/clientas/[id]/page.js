import { redirect } from 'next/navigation';
import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import ClientForm from '../ClientForm';

export const dynamic = 'force-dynamic';
const STATUS = { pending: 'Por confirmar', confirmed: 'Confirmada', completed: 'Completada', cancelled: 'Cancelada', no_show: 'No vino' };
const when = (iso) => new Date(iso).toLocaleString('es-EC', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil',
});

export default async function Client({ params }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const { id } = await params;
  const { data: c } = await db.from('clients').select('*').eq('id', id).maybeSingle();
  if (!c) return <main className="wide"><a href="/admin/clientas">‹ Clientas</a><p>No encontramos a esta clienta.</p></main>;
  const { data: visits } = await db.from('appointments')
    .select('id,starts_at,status,price,early_fee,notes,guest_name,services(name),stylists(name)')
    .eq('client_id', id).order('starts_at', { ascending: false });
  const done = (visits || []).filter((v) => v.status === 'completed');
  const total = done.reduce((s, v) => s + Number(v.price) + Number(v.early_fee), 0);

  return (
    <main className="wide">
      <a href="/admin/clientas">‹ Clientas</a>
      <h1>{c.full_name}</h1>
      <p className="note">
        {done.length} {done.length === 1 ? 'visita completada' : 'visitas completadas'} · ${total.toFixed(2)} en total ·{' '}
        <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}>Escribir por WhatsApp</a>
      </p>
      <ClientForm client={{
        id: c.id, full_name: c.full_name, phone: c.phone, email: c.email, cedula: c.cedula,
        birthday_month: c.birthday_month, birthday_day: c.birthday_day, internal_notes: c.internal_notes,
      }} />
      <h2>Historial</h2>
      {(visits || []).length === 0 && <p className="note">Todavía no tiene visitas.</p>}
      {(visits || []).map((v) => (
        <div className="appt" key={v.id}>
          <strong>{v.services.name}</strong>{v.guest_name && ` (para ${v.guest_name})`} · {v.stylists.name}
          <div className="note">{when(v.starts_at)} · ${v.price}{v.early_fee > 0 && ` + $${v.early_fee}`} · {STATUS[v.status]}</div>
          {v.notes && <div style={{ whiteSpace: 'pre-wrap' }}>📝 {v.notes}</div>}
        </div>
      ))}
    </main>
  );
}
