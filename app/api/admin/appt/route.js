import { db, getGroupSlots, moveGroup, earlyFeeFor } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

const bad = (error, status) => Response.json({ error }, { status });
const BUSY = 'No se pudo completar. ¿Ese horario ya está ocupado?';
const snap = (a) => ({
  starts_at: a.starts_at, ends_at: a.ends_at, started_at: a.started_at,
  checked_in_at: a.checked_in_at, overlap_ok: a.overlap_ok,
});

export async function POST(req) {
  if (!(await isAdmin())) return bad('No autorizado', 401);
  const { id, action, notes, prev, starts_at } = await req.json();
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

  // Filas de la reserva completa (si fue para varias personas) de la cita indicada.
  const groupOf = async (statusList) => {
    const { data: me } = await db.from('appointments').select('group_id').eq('id', id).maybeSingle();
    let q = db.from('appointments').select('id,service_id,stylist_id,starts_at,ends_at,price,early_fee,status,change_starts_at,change_stylist_id');
    q = me?.group_id ? q.eq('group_id', me.group_id) : q.eq('id', id);
    const { data } = await q.in('status', statusList);
    return data || [];
  };
  const CLEAR = { change_starts_at: null, change_ends_at: null, change_stylist_id: null, change_early_fee: null, change_requested_at: null };

  // Un cliente pidió cambiar una cita ya confirmada: Elena acepta el cambio o lo deja como estaba.
  if (action === 'confirm_change' || action === 'reject_change') {
    const rows = (await groupOf(['confirmed'])).filter((r) => r.change_starts_at);
    if (!rows.length) return bad('Este cambio ya fue respondido o el cliente lo canceló.', 409);
    if (action === 'reject_change') {
      await db.from('appointments').update(CLEAR).in('id', rows.map((r) => r.id));
      return Response.json({ ok: true });
    }
    rows.sort((x, y) => +new Date(x.change_starts_at) - +new Date(y.change_starts_at));
    const first = rows[0];
    const date = new Date(+new Date(first.change_starts_at) - 5 * 3600000).toISOString().slice(0, 10);
    const { slots } = await getGroupSlots(date, rows.map((r) => r.service_id), rows.map((r) => r.id), 0);
    const slot = slots.find((s) => s.starts_at === new Date(first.change_starts_at).toISOString());
    if (!slot) return bad('Ese horario ya no está libre. Rechaza el cambio o propón otra hora.', 409);
    const moved = await moveGroup(rows, first.change_starts_at, slot.stylist_id, CLEAR);
    return moved.ok ? Response.json({ ok: true }) : bad('Ese horario acaba de ocuparse. Propón otra hora.', 409);
  }

  // Elena propone otra hora a una solicitud nueva: la solicitud sigue pendiente hasta que el cliente la acepte con un toque.
  if (action === 'propose') {
    const rows = (await groupOf(['pending'])).sort((x, y) => +new Date(x.starts_at) - +new Date(y.starts_at));
    if (!rows.length) return bad('Esta solicitud ya fue respondida o cancelada por el cliente.', 409);
    const day = new Date(+new Date(starts_at) - 5 * 3600000).toISOString().slice(0, 10);
    const { slots } = await getGroupSlots(day, rows.map((r) => r.service_id), rows.map((r) => r.id), 0);
    const slot = slots.find((x) => x.starts_at === new Date(starts_at).toISOString());
    if (!slot) return bad('Ese horario ya no está libre. Elige otro.', 409);
    let cursor = +new Date(starts_at);
    for (const row of rows) {
      const ms = +new Date(row.ends_at) - +new Date(row.starts_at);
      const start = new Date(cursor).toISOString(), end = new Date(cursor + ms).toISOString();
      await db.from('appointments').update({
        change_starts_at: start, change_ends_at: end, change_stylist_id: slot.stylist_id,
        change_early_fee: await earlyFeeFor(start, +row.price), change_requested_at: new Date().toISOString(),
      }).eq('id', row.id);
      cursor += ms;
    }
    return Response.json({ ok: true });
  }

  // Elena retira su propuesta: la solicitud vuelve a "Por confirmar".
  if (action === 'withdraw') {
    const rows = (await groupOf(['pending'])).filter((r) => r.change_starts_at);
    if (rows.length) await db.from('appointments').update(CLEAR).in('id', rows.map((r) => r.id));
    return Response.json({ ok: true });
  }

  // Solicitudes de clientas: Elena las confirma o las rechaza.
  if (action === 'confirm' || action === 'reject') {
    const patch = action === 'confirm'
      ? { status: 'confirmed' }
      : { status: 'cancelled', cancelled_at: new Date().toISOString() };
    // Si la reserva fue para varias personas, se confirma o rechaza completa.
    const { data: me } = await db.from('appointments').select('group_id').eq('id', id).maybeSingle();
    let q0 = db.from('appointments').update(patch).eq('status', 'pending');
    q0 = me?.group_id ? q0.eq('group_id', me.group_id) : q0.eq('id', id);
    const { data, error } = await q0.select('id');
    if (error) return bad(BUSY, 409);
    if (!data?.length) return bad('Esta solicitud ya fue respondida o cancelada por el cliente.', 409);
    return Response.json({ ok: true });
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
