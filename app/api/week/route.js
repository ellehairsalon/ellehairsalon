import { getSlots } from '@/lib/slots';

const day = (start, i) => new Date(+new Date(start + 'T12:00:00Z') + i * 864e5).toISOString().slice(0, 10);

// Siete días de golpe: horarios libres de cada uno, para dibujar la tira semanal sin pedir día por día.
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const start = p.get('start'), service = p.get('service');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !service)
    return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  const days = await Promise.all(Array.from({ length: 7 }, async (_, i) => {
    const date = day(start, i);
    const { slots } = await getSlots(date, service);
    return { date, slots: slots.map(({ time, starts_at, early, fee }) => ({ time, starts_at, early, fee })) };
  }));
  return Response.json({ days });
}
