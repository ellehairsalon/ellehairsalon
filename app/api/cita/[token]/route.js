import { db, getGroupSlots, earlyFeeFor } from '@/lib/slots';
import { validEmail, validBirthday } from '@/lib/validate';

const SEL = 'id,client_id,service_id,starts_at,ends_at,price,early_fee,status,group_id,guest_name,services(name,duration_min),clients(full_name,email,birthday_month,birthday_day)';
const bad = (error, status) => Response.json({ error }, { status });
const hoursLeft = (a) => (+new Date(a.starts_at) - Date.now()) / 3600000;
const minHours = async () =>
  (await db.from('salon_settings').select('reschedule_min_hours').eq('id', 1).single()).data.reschedule_min_hours;
const ACTIVE = ['confirmed', 'pending'];

// Devuelve todas las citas de la reserva (si fue para varias personas, el enlace de cualquiera abre el grupo completo).
async function load(token) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data: row } = await db.from('appointments').select(SEL).eq('manage_token', token).maybeSingle();
  if (!row) return null;
  if (!row.group_id) return [row];
  const { data } = await db.from('appointments').select(SEL).eq('group_id', row.group_id).order('starts_at');
  return data?.length ? data : [row];
}

export async function GET(req, { params }) {
  const { token } = await params;
  const group = await load(token);
  if (!group) return bad('No encontramos esta cita.', 404);
  const live = group.filter((x) => ACTIVE.includes(x.status));
  const a = live[0] || group[0]; // la primera cita vigente marca la hora de la reserva
  const hours = await minHours();
  // Una solicitud en revisión se puede cambiar o cancelar libremente; una cita confirmada, hasta 'hours' antes.
  const canChange = a.status === 'pending' ? hoursLeft(a) > 0 : a.status === 'confirmed' && hoursLeft(a) >= hours;
  const date = new URL(req.url).searchParams.get('date');
  let slots = [];
  if (canChange && /^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    slots = (await getGroupSlots(date, live.map((x) => x.service_id), live.map((x) => x.id))).slots
      .map(({ time, starts_at, early, fee }) => ({ time, starts_at, early, fee }));
  }
  return Response.json({
    appt: {
      service: a.services.name, starts_at: a.starts_at, status: a.status,
      price: live.reduce((n, x) => n + +x.price, 0), early_fee: live.reduce((n, x) => n + +x.early_fee, 0),
      items: live.map((x) => ({ service: x.services.name, guest_name: x.guest_name, starts_at: x.starts_at, ends_at: x.ends_at })),
    },
    canChange, hours, slots, deadline: +new Date(a.starts_at) - hours * 3600000,
    profile: { needs: !a.clients?.email || !a.clients?.birthday_month }, // ¿falta completar el perfil?
  });
}

export async function POST(req, { params }) {
  const { token } = await params;
  const group = await load(token);
  if (!group) return bad('No encontramos esta cita.', 404);
  const a0 = group[0];
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
    const { error } = await db.from('clients').update(patch).eq('id', a0.client_id);
    return error ? bad('No se pudo guardar.', 500) : Response.json({ ok: true });
  }

  const live = group.filter((x) => ACTIVE.includes(x.status));
  const a = live[0];
  if (!a || hoursLeft(a) <= 0) return bad('Esta cita ya no se puede modificar.', 409);
  const hours = await minHours();

  if (action === 'cancel') {
    await db.from('appointments').update({
      status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_late: a.status === 'confirmed' && hoursLeft(a) < hours,
    }).in('id', live.map((x) => x.id)).in('status', ACTIVE);
    return Response.json({ ok: true });
  }

  if (action === 'reschedule') {
    if (a.status === 'confirmed' && hoursLeft(a) < hours) return bad(`Para cambios con menos de ${hours} horas, escríbenos por WhatsApp.`, 403);
    const { slots, items } = await getGroupSlots(String(starts_at).slice(0, 10), live.map((x) => x.service_id), live.map((x) => x.id));
    const slot = slots.find((s) => s.starts_at === starts_at);
    if (!slot) return bad('Ese horario ya no está disponible. Elige otro.', 409);

    // Nuevos horarios, uno tras otro. Se mueven en el orden que evita que se pisen entre ellos.
    let cursor = +new Date(starts_at);
    const plan = [];
    for (let i = 0; i < live.length; i++) {
      const start = new Date(cursor).toISOString(), end = new Date(cursor + items[i].duration_min * 60000).toISOString();
      plan.push({ row: live[i], start, end, fee: await earlyFeeFor(start, +live[i].price) });
      cursor += items[i].duration_min * 60000;
    }
    const later = +new Date(starts_at) > +new Date(a.starts_at);
    const order = later ? [...plan].reverse() : plan;
    const done = [];
    for (const x of order) {
      const { error } = await db.from('appointments')
        .update({ starts_at: x.start, ends_at: x.end, stylist_id: slot.stylist_id, early_fee: x.fee }).eq('id', x.row.id);
      if (error) { // deshace lo ya movido para no dejar la reserva a medias
        for (const d of done.reverse())
          await db.from('appointments').update({ starts_at: d.row.starts_at, ends_at: d.row.ends_at, early_fee: d.row.early_fee }).eq('id', d.row.id);
        return bad('Ese horario acaba de ocuparse. Elige otro.', 409);
      }
      done.push(x);
    }
    return Response.json({ ok: true });
  }
  return bad('Acción inválida.', 400);
}
