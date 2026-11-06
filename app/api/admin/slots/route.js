import { db, getGroupSlots, nextFreeStart, lunchOf } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

const dayOf = (i) => new Date(Date.now() - 5 * 3600000 + i * 864e5).toISOString().slice(0, 10);

export async function GET(req) {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const ids = (p.get('services') || p.get('service') || '').split(',').filter(Boolean);
  if (!ids.length) return Response.json({ slots: [], slot: null });
  if (p.get('next')) { // primer hueco libre real desde ahora
    const nf = await nextFreeStart(ids);
    return Response.json({ next: nf ? { starts_at: nf.starts_at, minutes: nf.minutes } : null });
  }
  if (p.get('check')) { // ¿qué citas chocan con esta hora? (para avisar antes de forzarla)
    const { items } = await getGroupSlots(p.get('date') || '2000-01-01', ids, [], 0);
    const total = (items || []).reduce((n, x) => n + (x?.duration_min || 0), 0);
    const a = new Date(p.get('check'));
    if (Number.isNaN(+a) || !total) return Response.json({ conflicts: [] });
    const b = new Date(+a + total * 60000);
    const { data } = await db.from('appointments').select('starts_at,ends_at,guest_name,clients(full_name)')
      .in('status', ['confirmed', 'pending']).lt('starts_at', b.toISOString()).gt('ends_at', a.toISOString()).order('starts_at').limit(5);
    const wd = new Date(`${p.get('date')}T12:00:00-05:00`).getUTCDay();
    const { data: hrs } = await db.from('business_hours').select('*').eq('weekday', wd).maybeSingle();
    const lu = lunchOf(hrs);
    const pad = (n) => String(n).padStart(2, '0');
    const luA = lu && new Date(`${p.get('date')}T${pad(Math.floor(lu[0] / 60))}:${pad(lu[0] % 60)}:00-05:00`);
    const luB = lu && new Date(`${p.get('date')}T${pad(Math.floor(lu[1] / 60))}:${pad(lu[1] % 60)}:00-05:00`);
    const lunchHit = lu && luA < b && luB > a ? [{ name: 'Almuerzo', lunch: true, starts_at: luA.toISOString(), ends_at: luB.toISOString() }] : [];
    return Response.json({ conflicts: [...lunchHit, ...(data || []).map((x) => ({ name: x.guest_name || x.clients?.full_name, starts_at: x.starts_at, ends_at: x.ends_at }))] });
  }
  if (p.get('asap')) { // primer hueco libre desde ahora
    for (let i = 0; i < 14; i++) {
      const { slots } = await getGroupSlots(dayOf(i), ids, [], 0);
      if (slots.length) {
        const s = slots[0];
        return Response.json({ slot: { ...s, minutes: Math.max(0, Math.round((+new Date(s.starts_at) - Date.now()) / 60000)) } });
      }
    }
    return Response.json({ slot: null });
  }
  const { slots } = await getGroupSlots(p.get('date'), ids, [], 0);
  return Response.json({ slots });
}
