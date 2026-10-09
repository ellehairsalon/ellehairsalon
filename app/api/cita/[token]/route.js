import { db, getSlots } from '@/lib/slots';
import { validEmail, validBirthday } from '@/lib/validate';

const SEL = 'id,client_id,service_id,starts_at,ends_at,price,early_fee,status,services(name,duration_min),clients(full_name,email,birthday_month,birthday_day)';
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
  // Una solicitud en revisión se puede cambiar o cancelar libremente; una cita confirmada, hasta 'hours' antes.
  const canChange = a.status === 'pending' ? hoursLeft(a) > 0 : a.status === 'confirmed' && hoursLeft(a) >= hours;
  const date = new URL(req.url).searchParams.get('date');
  let slots = [];
  if (canChange && /^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    slots = (await getSlots(date, a.service_id, a.id)).slots
      .map(({ time, starts_at, early, fee }) => ({ time, starts_at, early, fee }));
  }
  return Response.json({
    appt: { service: a.services.name, starts_at: a.starts_at, price: a.price, early_fee: a.early_fee, status: a.status },
    canChange, hours, slots,
    profile: { needs: !a.clients?.email || !a.clients?.birthday_month }, // ¿falta completar el perfil?
  });
}

export async function POST(req, { params }) {
  const { token } = await params;
  const a = await load(token);
  if (!a) return bad('No encontramos esta cita.', 404);
  const body = await req.json();
  const { action, starts_at } = body;

  // Perfil opcional: correo y cumpleaños. Solo quien tiene el enlace privado de la cita puede enviarlo.
  if (action === 'profile') {
    const patch = {};
    const email = String(body.email || '').trim().toLowerCase();
    if (email) {
      if (!validEmail(email)) return bad('Revisa tu correo.', 400);
      patch.email = email;
    }
    if (body.birthday_month || body.birthday_day) {
      const m = +body.birthday_month, d = +body.birthday_day;
      if (!validBirthday(m, d)) return bad('Revisa el día y el mes de tu cumpleaños.', 400);
      patch.birthday_month = m; patch.birthday_day = d;
    }
    if (!Object.keys(patch).length) return bad('Escribe tu correo o tu cumpleaños.', 400);
    const { error } = await db.from('clients').update(patch).eq('id', a.client_id);
    return error ? bad('No se pudo guardar.', 500) : Response.json({ ok: true });
  }

  if (!['confirmed', 'pending'].includes(a.status) || hoursLeft(a) <= 0) return bad('Esta cita ya no se puede modificar.', 409);
  const hours = await minHours();

  if (action === 'cancel') {
    await db.from('appointments').update({
      status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_late: a.status === 'confirmed' && hoursLeft(a) < hours,
    }).eq('id', a.id).in('status', ['confirmed', 'pending']);
    return Response.json({ ok: true });
  }

  if (action === 'reschedule') {
    if (a.status === 'confirmed' && hoursLeft(a) < hours) return bad(`Para cambios con menos de ${hours} horas, escríbenos por WhatsApp.`, 403);
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
