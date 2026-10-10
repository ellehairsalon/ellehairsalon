import { randomUUID } from 'crypto';
import { db, getGroupSlots, earlyFeeFor } from '@/lib/slots';
import { normPhone } from '@/lib/validate';

const err = (error, status) => Response.json({ error }, { status });
const toMin = (t) => { const [h, m] = t.split(':'); return +h * 60 + +m; };

// Cuándo volverá a abrir el salón (hora de Ecuador), para avisar a quien pide cita fuera de horario.
async function nextOpening() {
  const { data: hrs } = await db.from('business_hours').select('*');
  if (!hrs?.length) return { open_now: true };
  const now = new Date(Date.now() - 5 * 3600000); // hora Ecuador en campos UTC
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const today = hrs.find((h) => h.weekday === now.getUTCDay());
  if (today?.is_open && nowMin >= toMin(today.open_time) && nowMin < toMin(today.close_time)) return { open_now: true };
  for (let i = 0; i < 8; i++) {
    const wd = (now.getUTCDay() + i) % 7;
    const h = hrs.find((x) => x.weekday === wd);
    if (!h?.is_open) continue;
    if (i === 0 && nowMin >= toMin(h.open_time)) continue; // hoy ya cerró
    const when = i === 0 ? 'hoy' : i === 1 ? 'mañana' : ['el domingo', 'el lunes', 'el martes', 'el miércoles', 'el jueves', 'el viernes', 'el sábado'][wd];
    return { open_now: false, opens: `${when} desde las ${h.open_time.slice(0, 5)}` };
  }
  return { open_now: false, opens: 'pronto' };
}

const MAX_PEOPLE = 5;

export async function POST(req) {
  const body = await req.json();
  const { starts_at, name, phone, note } = body;
  // items: un servicio por persona. El primero es quien reserva; los demás son invitados con su nombre.
  const raw = Array.isArray(body.items) && body.items.length ? body.items : [{ service_id: body.service_id }];
  const items = raw.slice(0, MAX_PEOPLE).map((it, i) => ({
    service_id: it.service_id, guest: i === 0 ? null : String(it.guest_name || '').trim().slice(0, 60),
  }));
  const p = normPhone(phone), n = String(name || '').trim().slice(0, 100);
  if (!p || n.length < 2 || !/^\d{4}-\d{2}-\d{2}T/.test(starts_at || '') || items.some((it) => !it.service_id))
    return err('Revisa tu nombre y tu número de WhatsApp.', 400);
  if (items.slice(1).some((it) => it.guest.length < 2)) return err('Escribe el nombre de cada persona.', 400);

  // El horario se vuelve a validar en el servidor (incluida la anticipación mínima): nunca se confía en el navegador.
  const { slots, items: svcs, svc } = await getGroupSlots(starts_at.slice(0, 10), items.map((it) => it.service_id));
  const slot = slots.find((s) => s.starts_at === starts_at);
  if (!slot) return err('Ese horario ya no está disponible. Elige otro.', 409);

  let { data: client } = await db.from('clients').select('*').eq('phone', p).maybeSingle();
  if (!client) ({ data: client } = await db.from('clients').insert({ phone: p, full_name: n }).select().single());

  const { data: act } = await db.from('appointments').select('id,status')
    .eq('client_id', client.id).in('status', ['confirmed', 'pending']).limit(1);
  const active = act?.[0];
  if (active) return err(
    active.status === 'pending'
      ? 'Ya tienes una solicitud en revisión. Para verla, cambiarla o cancelarla usa el enlace que te dimos o escríbenos por WhatsApp.'
      : 'Ya tienes una cita agendada. Para cambiarla o cancelarla usa el enlace de tu confirmación o escríbenos por WhatsApp.', 409);

  // ¿Esta reserva necesita que Elena la revise?
  const { data: cfg } = await db.from('salon_settings').select('approval_mode').eq('id', 1).single();
  const mode = cfg?.approval_mode || 'manual';
  let needsReview = mode === 'manual';
  if (mode === 'mixed') { // revisa: horario temprano con recargo, 3 h o más, clientas nuevas y reservas para varias personas
    const { count } = await db.from('appointments').select('id', { count: 'exact', head: true })
      .eq('client_id', client.id).eq('status', 'completed');
    needsReview = slot.fee > 0 || svc.duration_min >= 180 || !count || items.length > 1;
  }

  // Una cita por persona, una tras otra, con la misma estilista. Se guardan todas juntas o ninguna.
  const group_id = items.length > 1 ? randomUUID() : null;
  let cursor = +new Date(starts_at);
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const sv = svcs[i];
    const start = new Date(cursor).toISOString(), end = new Date(cursor + sv.duration_min * 60000).toISOString();
    rows.push({
      client_id: client.id, stylist_id: slot.stylist_id, service_id: sv.id, starts_at: start, ends_at: end,
      price: sv.price, early_fee: await earlyFeeFor(start, +sv.price), status: needsReview ? 'pending' : 'confirmed',
      group_id, guest_name: items[i].guest, client_note: i === 0 ? String(note || '').trim().slice(0, 300) || null : null,
    });
    cursor += sv.duration_min * 60000;
  }
  const { data: appts, error } = await db.from('appointments').insert(rows).select('manage_token');
  if (error) return err('Ese horario acaba de ocuparse. Elige otro.', 409);
  return Response.json({ token: appts[0].manage_token, status: needsReview ? 'pending' : 'confirmed', ...(needsReview ? await nextOpening() : {}) });
}
