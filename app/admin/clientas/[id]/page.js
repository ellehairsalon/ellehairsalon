import { redirect } from 'next/navigation';
import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import BirthdayForm from '../BirthdayForm';

export const dynamic = 'force-dynamic';
const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const STATUS = { confirmed: 'Pendiente', completed: 'Completada', cancelled: 'Cancelada', no_show: 'No vino' };
const when = (iso) => new Date(iso).toLocaleString('es-EC', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil',
});

export default async function Client({ params }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const { id } = await params;
  const { data: c } = await db.from('clients').select('*').eq('id', id).maybeSingle();
  if (!c) return <main className="wide"><p>No encontramos a esta clienta.</p></main>;
  const { data: visits } = await db.from('appointments')
    .select('id,starts_at,status,price,early_fee,notes,services(name),stylists(name)')
    .eq('client_id', id).order('starts_at', { ascending: false });
  const done = (visits || []).filter((v) => v.status === 'completed');
  const total = done.reduce((s, v) => s + Number(v.price) + Number(v.early_fee), 0);

  return (
    <main className="wide">
      <a href="/admin/clientas">‹ Clientas</a>
      <h1>{c.full_name}</h1>
      <p><a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`}>{c.phone}</a>
        {c.birthday_month && ` · 🎂 ${c.birthday_day} de ${MES[c.birthday_month - 1]}`}</p>
      <p className="note">{done.length} {done.length === 1 ? 'visita completada' : 'visitas completadas'} · ${total.toFixed(2)} en total</p>
      <BirthdayForm id={c.id} month={c.birthday_month} day={c.birthday_day} />
      <h2>Historial</h2>
      {(visits || []).map((v) => (
        <div className="appt" key={v.id}>
          <strong>{v.services.name}</strong> · {v.stylists.name}
          <div className="note">{when(v.starts_at)} · ${v.price}{v.early_fee > 0 && ` + $${v.early_fee}`} · {STATUS[v.status]}</div>
          {v.notes && <div>📝 {v.notes}</div>}
        </div>
      ))}
    </main>
  );
}
