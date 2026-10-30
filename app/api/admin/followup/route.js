import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import { followActionsSupported } from '@/lib/notify';

const bad = (error, status = 400) => Response.json({ error }, { status });

// Elena marca qué hizo con un aviso de seguimiento: ya la contacté / no volverá / deshacer.
export async function POST(req) {
  if (!(await isAdmin())) return bad('No autorizado', 401);
  const { client_id, appt_id, action } = await req.json();
  if (!client_id || !appt_id) return bad('Datos inválidos');
  if (!(await followActionsSupported())) return bad('Falta correr migration-16.sql en Supabase.', 409);
  if (action === 'undo') {
    const { error } = await db.from('followup_actions').delete().eq('client_id', client_id).eq('appt_id', appt_id);
    return error ? bad('No se pudo guardar.', 500) : Response.json({ ok: true });
  }
  if (action !== 'contacted' && action !== 'dismissed') return bad('Acción inválida');
  const { error } = await db.from('followup_actions').upsert({ client_id, appt_id, action, at: new Date().toISOString() });
  return error ? bad('No se pudo guardar.', 500) : Response.json({ ok: true });
}
