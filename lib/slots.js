import { createClient } from '@supabase/supabase-js';

export const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TZ = '-05:00'; // Ecuador continental, sin horario de verano
const toMin = (t) => { const [h, m] = t.split(':'); return +h * 60 + +m; };
const iso = (date, min) =>
  `${date}T${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00${TZ}`;

// Horarios libres de un día para una o varias personas (un servicio por persona), una tras otra con la misma estilista.
// ignoreIds: citas que no cuentan como ocupadas (al cambiar una reserva, ella misma).
export async function getGroupSlots(date, serviceIds, ignoreIds = [], leadMs) {
  const ids = [...new Set(serviceIds)];
  const weekday = new Date(`${date}T12:00:00${TZ}`).getUTCDay();
  const [{ data: cfg }, { data: hrs }, { data: found }] = await Promise.all([
    db.from('salon_settings').select('*').eq('id', 1).single(),
    db.from('business_hours').select('*').eq('weekday', weekday).single(),
    db.from('services').select('*').in('id', ids).eq('is_active', true),
  ]);
  const byId = Object.fromEntries((found || []).map((x) => [x.id, x]));
  const items = serviceIds.map((id) => byId[id]);
  if (!cfg || !hrs?.is_open || items.some((x) => !x)) return { slots: [], items, svc: items[0] };

  const total = items.reduce((n, x) => n + x.duration_min, 0);

  // Solo estilistas que hacen TODOS los servicios del grupo
  const { data: links } = await db
    .from('stylist_services')
    .select('service_id,stylists!inner(id,is_bookable,sort_order)')
    .in('service_id', ids)
    .eq('stylists.is_bookable', true);
  const per = {};
  (links || []).forEach((l) => { (per[l.stylists.id] ||= { st: l.stylists, n: new Set() }).n.add(l.service_id); });
  const stylists = Object.values(per).filter((x) => x.n.size === ids.length).map((x) => x.st)
    .sort((a, b) => a.sort_order - b.sort_order);

  const dayStart = iso(date, 0), dayEnd = iso(date, 1439);
  const [{ data: appts }, { data: off }] = await Promise.all([
    (() => {
      const q = db.from('appointments').select('stylist_id,starts_at,ends_at').in('status', ['confirmed', 'pending'])
        .gte('starts_at', dayStart).lte('starts_at', dayEnd);
      return ignoreIds.length ? q.not('id', 'in', `(${ignoreIds.join(',')})`) : q; // al cambiar una reserva, ella misma no cuenta
    })(),
    db.from('stylist_time_off').select('stylist_id,starts_at,ends_at')
      .lt('starts_at', dayEnd).gt('ends_at', dayStart),
  ]);
  const busy = [...(appts || []), ...(off || [])].map((x) => ({
    s: x.stylist_id, a: +new Date(x.starts_at), b: +new Date(x.ends_at),
  }));

  const open = toMin(hrs.open_time), close = toMin(hrs.close_time);
  const from = hrs.early_open_time ? toMin(hrs.early_open_time) : open;
  const feeOf = (price) => (cfg.early_fee_type === 'percent' ? +(price * cfg.early_fee_value / 100).toFixed(2) : +cfg.early_fee_value);

  // Anticipación mínima: la que define Elena en Ajustes (10 h por defecto). En el panel se pasa 0.
  const lead = leadMs ?? (cfg.online_lead_hours ?? 10) * 3600000;
  const slots = [];
  for (let m = from; m + total <= close; m += cfg.slot_minutes) {
    const a = +new Date(iso(date, m)), b = a + total * 60000;
    if (a < Date.now() + lead) continue;
    const free = stylists.find((st) => !busy.some((x) => x.s === st.id && x.a < b && x.b > a));
    if (!free) continue;
    // Cada persona que empieza antes de la hora de apertura paga el recargo por horario temprano.
    let cum = 0, fee = 0;
    for (const it of items) { if (m + cum < open) fee += feeOf(it.price); cum += it.duration_min; }
    slots.push({
      time: iso(date, m).slice(11, 16), starts_at: iso(date, m),
      stylist_id: free.id, early: m < open, fee: +fee.toFixed(2),
    });
  }
  return { slots, items, svc: { ...items[0], duration_min: total, price: items.reduce((n, x) => n + +x.price, 0) } };
}

// Compatibilidad: una sola persona, un solo servicio.
export async function getSlots(date, serviceId, ignoreId, leadMs) {
  const r = await getGroupSlots(date, [serviceId], ignoreId ? [ignoreId] : [], leadMs);
  return { slots: r.slots, svc: r.items[0] };
}

// Recargo por horario temprano de una cita que empieza en startIso (mismo cálculo que arriba, fila por fila)
export async function earlyFeeFor(startIso, price) {
  const { data: cfg } = await db.from('salon_settings').select('*').eq('id', 1).single();
  const wd = new Date(+new Date(startIso) - 5 * 3600000);
  const { data: hrs } = await db.from('business_hours').select('open_time').eq('weekday', wd.getUTCDay()).single();
  if (!cfg || !hrs) return 0;
  const m = wd.getUTCHours() * 60 + wd.getUTCMinutes();
  if (m >= toMin(hrs.open_time)) return 0;
  return cfg.early_fee_type === 'percent' ? +(price * cfg.early_fee_value / 100).toFixed(2) : +cfg.early_fee_value;
}
