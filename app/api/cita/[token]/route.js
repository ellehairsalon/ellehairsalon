import { db, getGroupSlots, earlyFeeFor, isEarlyAt, moveGroup } from '@/lib/slots';
import { validEmail, validBirthday } from '@/lib/validate';

const SEL = 'id,client_id,service_id,starts_at,ends_at,price,early_fee,status,change_starts_at,change_ends_at,group_id,guest_name,services(name,duration_min,price_from),clients(full_name,email,birthday_month,birthday_day)';
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
  const { data: pc } = await db.from('salon_settings').select('early_bonus,early_fee_type,early_fee_value').eq('id', 1).single();
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
      early: await isEarlyAt(live[0].starts_at),
      change: a.status === 'confirmed' ? live.find((x) => x.change_starts_at)?.change_starts_at || null : null,
      proposal: a.status === 'pending' ? live.find((x) => x.change_starts_at)?.change_starts_at || null : null,
      items: live.map((x) => ({ service: x.services.name, price: +x.price, price_from: !!x.services.price_from, guest_name: x.guest_name, starts_at: x.starts_at, ends_at: x.ends_at })),
    },
    canChange, hours, slots, bonus: pc?.early_bonus || 'Lavado con masaje de cuero cabelludo', feeType: pc?.early_fee_type || 'fixed', feeValue: pc?.early_fee_value ?? 0, deadline: +new Date(a.starts_at) - hours * 3600000,
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

  // El cliente acepta la hora que propuso Elena: la solicitud queda confirmada.
  if (action === 'accept') {
    const rows = live.filter((x) => x.change_starts_at).sort((x, y) => +new Date(x.change_starts_at) - +new Date(y.change_starts_at));
    if (a.status !== 'pending' || !rows.length) return bad('Esta propuesta ya no está vigente.', 409);
    const first = rows[0];
    const day = new Date(+new Date(first.change_starts_at) - 5 * 3600000).toISOString().slice(0, 10);
    const { slots } = await getGroupSlots(day, live.map((x) => x.service_id), live.map((x) => x.id), 0);
    const slot = slots.find((s) => +new Date(s.starts_at) === +new Date(first.change_starts_at));
    if (!slot) return bad('Ese horario ya no está libre. Elige otra hora y Elena te confirma.', 409);
    const moved = await moveGroup(live, first.change_starts_at, slot.stylist_id, { status: 'confirmed', change_starts_at: null, change_ends_at: null, change_stylist_id: null, change_early_fee: null, change_requested_at: null });
    if (!moved.ok) return bad('Ese horario acaba de ocuparse. Elige otra hora.', 409);
    return Response.json({ ok: true });
  }

  if (action === 'reschedule') {
    if (a.status === 'confirmed' && hoursLeft(a) < hours) return bad(`Para cambios con menos de ${hours} horas, escríbenos por WhatsApp.`, 403);
    const { slots, items } = await getGroupSlots(String(starts_at).slice(0, 10), live.map((x) => x.service_id), live.map((x) => x.id));
    const slot = slots.find((s) => +new Date(s.starts_at) === +new Date(starts_at));
    if (!slot) return bad('Ese horario ya no está disponible. Elige otro.', 409);

    const { data: cfg } = await db.from('salon_settings').select('approval_mode').eq('id', 1).single();
    // Una cita ya confirmada no se mueve sola: la original se queda y Elena confirma el cambio.
    if (a.status === 'confirmed' && (cfg?.approval_mode || 'manual') !== 'auto') {
      let cursor = +new Date(starts_at);
      for (const row of live) {
        const ms = +new Date(row.ends_at) - +new Date(row.starts_at);
        const start = new Date(cursor).toISOString(), end = new Date(cursor + ms).toISOString();
        await db.from('appointments').update({
          change_starts_at: start, change_ends_at: end, change_stylist_id: slot.stylist_id,
          change_early_fee: await earlyFeeFor(start, +row.price), change_requested_at: new Date().toISOString(),
        }).eq('id', row.id);
        cursor += ms;
      }
      return Response.json({ ok: true, requested: true });
    }
    const moved = await moveGroup(live, starts_at, slot.stylist_id, { change_starts_at: null, change_ends_at: null, change_stylist_id: null, change_early_fee: null, change_requested_at: null });
    if (!moved.ok) return bad('Ese horario acaba de ocuparse. Elige otro.', 409);
    return Response.json({ ok: true });
  }
  return bad('Acción inválida.', 400);
}
