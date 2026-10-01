import { getSlots } from '@/lib/slots';

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const date = p.get('date'), service = p.get('service');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !service)
    return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  const { slots } = await getSlots(date, service);
  return Response.json({ slots: slots.map(({ time, starts_at, early, fee }) => ({ time, starts_at, early, fee })) });
}
