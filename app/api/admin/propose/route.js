import { db, getGroupSlots } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

// Horarios libres para proponerle a una solicitud (toda la reserva junta, sin aviso mínimo).
export async function GET(req) {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const id = p.get('id'), date = p.get('date');
  if (!id || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  const { data: me } = await db.from('appointments').select('group_id').eq('id', id).maybeSingle();
  let q = db.from('appointments').select('id,service_id,starts_at').eq('status', 'pending');
  q = me?.group_id ? q.eq('group_id', me.group_id) : q.eq('id', id);
  const { data: rows } = await q;
  if (!rows?.length) return Response.json({ slots: [] });
  rows.sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  if (!date) { // sin día: los 3 horarios libres más cercanos a la hora que pidió el cliente (variados)
    const want = +new Date(rows[0].starts_at);
    const ids = rows.map((r) => r.service_id), own = rows.map((r) => r.id);
    const todayStr = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
    const wantStr = new Date(want - 5 * 3600000).toISOString().slice(0, 10);
    let startMs = Math.max(+new Date(todayStr + 'T12:00:00Z'), +new Date(wantStr + 'T12:00:00Z') - 2 * 864e5);
    const all = [];
    for (let i = 0; i < 10; i++) {
      const day = new Date(startMs + i * 864e5).toISOString().slice(0, 10);
      const r = await getGroupSlots(day, ids, own, 0);
      for (const s of r.slots) if (+new Date(s.starts_at) > Date.now() && +new Date(s.starts_at) !== want) all.push({ time: s.time, starts_at: s.starts_at, early: s.early });
    }
    all.sort((x, y) => Math.abs(+new Date(x.starts_at) - want) - Math.abs(+new Date(y.starts_at) - want));
    const dayOf = (iso) => new Date(+new Date(iso) - 5 * 3600000).toISOString().slice(0, 10);
    const pick = [];
    for (const c of all) {
      if (pick.length === 3) break;
      if (pick.every((q) => dayOf(q.starts_at) !== dayOf(c.starts_at) || Math.abs(+new Date(q.starts_at) - +new Date(c.starts_at)) >= 90 * 60000)) pick.push(c);
    }
    for (const c of all) { if (pick.length === 3) break; if (!pick.includes(c)) pick.push(c); }
    pick.sort((x, y) => +new Date(x.starts_at) - +new Date(y.starts_at));
    return Response.json({ slots: pick });
  }
  const { slots } = await getGroupSlots(date, rows.map((r) => r.service_id), rows.map((r) => r.id), 0);
  return Response.json({ slots: slots.map(({ time, starts_at, early }) => ({ time, starts_at, early })) });
}
