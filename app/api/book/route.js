import { db, getSlots } from '@/lib/slots';
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

export async function POST(req) {
  const { service_id, starts_at, name, phone } = await req.json();
  const p = normPhone(phone), n = String(name || '').trim().slice(0, 100);
  if (!p || n.length < 2 || !/^\d{4}-\d{2}-\d{2}T/.test(starts_at || ''))
    return err('Revisa tu nombre y tu número de WhatsApp.', 400);

  // El horario se vuelve a validar en el servidor (incluida la anticipación mínima): nunca se confía en el navegador.
  const { slots, svc } = await getSlots(starts_at.slice(0, 10), service_id);
  const slot = slots.find((s) => s.starts_at === starts_at);
  if (!slot) return err('Ese horario ya no está disponible. Elige otro.', 409);

  let { data: client } = await db.from('clients').select('*').eq('phone', p).maybeSingle();
  if (!client) ({ data: client } = await db.from('clients').insert({ phone: p, full_name: n }).select().single());

  const { data: active } = await db.from('appointments').select('id,status')
    .eq('client_id', client.id).in('status', ['confirmed', 'pending']).maybeSingle();
  if (active) return err(
    active.status === 'pending'
      ? 'Ya tienes una solicitud en revisión. Para verla, cambiarla o cancelarla usa el enlace que te dimos o escríbenos por WhatsApp.'
      : 'Ya tienes una cita agendada. Para cambiarla o cancelarla usa el enlace de tu confirmación o escríbenos por WhatsApp.', 409);

  // ¿Esta cita necesita que Elena la revise?
  const { data: cfg } = await db.from('salon_settings').select('approval_mode').eq('id', 1).single();
  const mode = cfg?.approval_mode || 'manual';
  let needsReview = mode === 'manual';
  if (mode === 'mixed') { // revisa: horario temprano con recargo, servicios largos (3 h o más) y clientas nuevas
    const { count } = await db.from('appointments').select('id', { count: 'exact', head: true })
      .eq('client_id', client.id).eq('status', 'completed');
    needsReview = slot.fee > 0 || svc.duration_min >= 180 || !count;
  }

  const ends_at = new Date(+new Date(starts_at) + svc.duration_min * 60000).toISOString();
  const { data: appt, error } = await db.from('appointments')
    .insert({
      client_id: client.id, stylist_id: slot.stylist_id, service_id, starts_at, ends_at,
      price: svc.price, early_fee: slot.fee, status: needsReview ? 'pending' : 'confirmed',
    })
    .select('manage_token').single();
  if (error) return err('Ese horario acaba de ocuparse. Elige otro.', 409);
  return Response.json({ token: appt.manage_token, status: needsReview ? 'pending' : 'confirmed', ...(needsReview ? await nextOpening() : {}) });
}
