import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

export async function POST(req) {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const { id, action } = await req.json();
  const patch = {
    cancel: { status: 'cancelled', cancelled_at: new Date().toISOString() },
    complete: { status: 'completed' },
    no_show: { status: 'no_show' },
  }[action];
  if (!patch || !id) return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  const { error } = await db.from('appointments').update(patch).eq('id', id).eq('status', 'confirmed');
  return error ? Response.json({ error: error.message }, { status: 500 }) : Response.json({ ok: true });
}
