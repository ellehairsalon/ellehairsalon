import { db, getSlots } from '@/lib/slots';

const SEL = 'id,service_id,starts_at,ends_at,price,early_fee,status,services(name,duration_min),clients(full_name)';
const bad = (error, status) => Response.json({ error }, { status });
const hoursLeft = (a) => (+new Date(a.starts_at) - Date.now()) / 3600000;
const minHours = async () =>
  (await db.from('salon_settings').select('reschedule_min_hours').eq('id', 1).single()).data.reschedule_min_hours;

async function load(token) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await db.from('appointments').select(SEL).eq('manage_token', token).maybeSingle();
  return data;
}

export async function GET(req, { params }) {
  const { token } = await params;
  const a = await load(token);
  if (!a) return bad('No encontramos esta cita.', 404);
  const hours = await minHours();
  const canChange = a.status === 'confirmed' && hoursLeft(a) >= hours;
  const date = new URL(req.url).searchParams.get('date');
  let slots = [];
  if (canChange && /^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    slots = (await getSlots(date, a.service_id, a.id)).slots
      .map(({ time, starts_at, early, fee }) => ({ time, starts_at, early, fee }));
  }
  return Response.json({
    appt: { service: a.services.name, starts_at: a.starts_at, price: a.price, early_fee: a.early_fee, status: a.status },
    canChange, hours, slots,
  });
}

export async function POST(req, { params }) {
  const { token } = await params;
  const a = await load(token);
  if (!a) return bad('No encontramos esta cita.', 404);
  if (a.status !== 'confirmed' || hoursLeft(a) <= 0) return bad('Esta cita ya no se puede modificar.', 409);
  const hours = await minHours();
  const { action, starts_at } = await req.json();

  if (action === 'cancel') {
    await db.from('appointments').update({
      status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_late: hoursLeft(a) < hours,
    }).eq('id', a.id);
    return Response.json({ ok: true });
  }

  if (action === 'reschedule') {
    if (hoursLeft(a) < hours) return bad(`Para cambios con menos de ${hours} horas, escríbenos por WhatsApp.`, 403);
    const { slots, svc } = await getSlots(String(starts_at).slice(0, 10), a.service_id, a.id);
    const slot = slots.find((s) => s.starts_at === starts_at);
    if (!slot) return bad('Ese horario ya no está disponible. Elige otro.', 409);
    const ends_at = new Date(+new Date(starts_at) + svc.duration_min * 60000).toISOString();
    const { error } = await db.from('appointments')
      .update({ starts_at, ends_at, stylist_id: slot.stylist_id, early_fee: slot.fee }).eq('id', a.id);
    if (error) return bad('Ese horario acaba de ocuparse. Elige otro.', 409);
    return Response.json({ ok: true });
  }
  return bad('Acción inválida.', 400);
}
