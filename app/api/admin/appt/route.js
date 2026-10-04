import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

const bad = (error, status) => Response.json({ error }, { status });
const BUSY = 'No se pudo completar. ¿Ese horario ya está ocupado?';
const snap = (a) => ({
  starts_at: a.starts_at, ends_at: a.ends_at, started_at: a.started_at,
  checked_in_at: a.checked_in_at, overlap_ok: a.overlap_ok,
});

export async function POST(req) {
  if (!(await isAdmin())) return bad('No autorizado', 401);
  const { id, action, notes, prev } = await req.json();
  if (!id) return bad('Datos inválidos', 400);

  // "Llegó" y "Empezar": se pueden usar aunque Elena ya esté atendiendo a otra clienta.
  if (action === 'start' || action === 'checkin') {
    const { data: a } = await db.from('appointments')
      .select('stylist_id,starts_at,ends_at,checked_in_at,started_at,overlap_ok')
      .eq('id', id).eq('status', 'confirmed').maybeSingle();
    if (!a) return bad('Esta cita ya no está pendiente.', 409);
    const now = new Date(); now.setSeconds(0, 0);
    const nowIso = now.toISOString();
    const patch = { checked_in_at: a.checked_in_at || nowIso };
    if (action === 'start') {
      patch.started_at = nowIso;
      if (+new Date(a.starts_at) > +now) { // adelanta la cita a este momento y libera su horario original
        const end = new Date(+now + (+new Date(a.ends_at) - +new Date(a.starts_at))).toISOString();
        const { count } = await db.from('appointments').select('id', { count: 'exact', head: true })
          .eq('stylist_id', a.stylist_id).eq('status', 'confirmed').neq('id', id)
          .lt('starts_at', end).gt('ends_at', nowIso);
        Object.assign(patch, { starts_at: nowIso, ends_at: end, overlap_ok: (count || 0) > 0 });
      }
    }
    const { error } = await db.from('appointments').update(patch).eq('id', id);
    return error ? bad(BUSY, 409) : Response.json({ ok: true, prev: snap(a) });
  }

  if (action === 'revert' && prev) {
    const { error } = await db.from('appointments').update({
      starts_at: prev.starts_at, ends_at: prev.ends_at, started_at: prev.started_at,
      checked_in_at: prev.checked_in_at, overlap_ok: !!prev.overlap_ok,
    }).eq('id', id);
    return error ? bad(BUSY, 409) : Response.json({ ok: true });
  }

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
    if (!patch) return bad('Datos inválidos', 400);
    q = q.update(patch).eq('id', id).eq('status', 'confirmed');
  }
  const { error } = await q;
  return error ? bad(BUSY, 409) : Response.json({ ok: true });
}
