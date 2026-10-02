import { getSlots } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

const dayOf = (i) => new Date(Date.now() - 5 * 3600000 + i * 864e5).toISOString().slice(0, 10);

export async function GET(req) {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const service = p.get('service');
  if (p.get('asap')) { // primer hueco libre desde ahora
    for (let i = 0; i < 14; i++) {
      const { slots } = await getSlots(dayOf(i), service, null, 0);
      if (slots.length) {
        const s = slots[0];
        return Response.json({ slot: { ...s, minutes: Math.max(0, Math.round((+new Date(s.starts_at) - Date.now()) / 60000)) } });
      }
    }
    return Response.json({ slot: null });
  }
  const { slots } = await getSlots(p.get('date'), service, null, 0);
  return Response.json({ slots });
}
