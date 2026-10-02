import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

export async function POST(req) {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const { id, action, notes } = await req.json();
  if (!id) return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  let q = db.from('appointments');
  if (action === 'note') q = q.update({ notes: String(notes || '').slice(0, 500) }).eq('id', id);
  else if (action === 'restore')
    q = q.update({ status: 'confirmed', cancelled_at: null, cancelled_late: false }).eq('id', id).neq('status', 'confirmed');
  else {
    const patch = {
      cancel: { status: 'cancelled', cancelled_at: new Date().toISOString() },
      complete: { status: 'completed' },
      no_show: { status: 'no_show' },
    }[action];
    if (!patch) return Response.json({ error: 'Datos inválidos' }, { status: 400 });
    q = q.update(patch).eq('id', id).eq('status', 'confirmed');
  }
  const { error } = await q;
  return error
    ? Response.json({ error: 'No se pudo completar. ¿Ese horario ya está ocupado?' }, { status: 409 })
    : Response.json({ ok: true });
}
