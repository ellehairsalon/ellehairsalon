import { createClient } from '@supabase/supabase-js';

export const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TZ = '-05:00'; // Ecuador continental, sin horario de verano
const toMin = (t) => { const [h, m] = t.split(':'); return +h * 60 + +m; };
// Almuerzo del día (hrs.lunch_start / lunch_end, opcional). Devuelve [inicio, fin] en minutos o null.
export const lunchOf = (h) => (h?.lunch_start && h?.lunch_end && toMin(h.lunch_end) > toMin(h.lunch_start) ? [toMin(h.lunch_start), toMin(h.lunch_end)] : null);
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
  const lunch = lunchOf(hrs);
  const slots = [];
  for (let m = from; m + total <= close; m += cfg.slot_minutes) {
    const a = +new Date(iso(date, m)), b = a + total * 60000;
    if (a < Date.now() + lead) continue;
    if (lunch && m < lunch[1] && m + total > lunch[0]) continue; // no se puede cruzar la hora de almuerzo
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

// ¿Esta hora de inicio cae antes de la apertura de ese día? (turno prioritario)
export async function isEarlyAt(startIso) {
  const wd = new Date(+new Date(startIso) - 5 * 3600000);
  const { data: hrs } = await db.from('business_hours').select('open_time').eq('weekday', wd.getUTCDay()).single();
  return !!hrs && wd.getUTCHours() * 60 + wd.getUTCMinutes() < toMin(hrs.open_time);
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


// Mueve una reserva completa (una o varias personas, una tras otra) a un nuevo horario.
// rows: filas de la reserva; cada duración sale de su propia hora de inicio y fin. extra: campos que se actualizan junto con el horario.
export async function moveGroup(rows, startsAt, stylistId, extra = {}) {
  const list = [...rows].sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  let cursor = +new Date(startsAt);
  const plan = [];
  for (const row of list) {
    const ms = +new Date(row.ends_at) - +new Date(row.starts_at);
    const start = new Date(cursor).toISOString(), end = new Date(cursor + ms).toISOString();
    plan.push({ row, start, end, fee: await earlyFeeFor(start, +row.price) });
    cursor += ms;
  }
  const later = +new Date(startsAt) > +new Date(list[0].starts_at);
  const order = later ? [...plan].reverse() : plan;
  const done = [];
  for (const x of order) {
    const { error } = await db.from('appointments')
      .update({ starts_at: x.start, ends_at: x.end, stylist_id: stylistId, early_fee: x.fee, ...extra }).eq('id', x.row.id);
    if (error) { // deshace lo ya movido para no dejar la reserva a medias
      for (const d of done.reverse())
        await db.from('appointments').update({ starts_at: d.row.starts_at, ends_at: d.row.ends_at, early_fee: d.row.early_fee, stylist_id: d.row.stylist_id }).eq('id', d.row.id);
      return { ok: false };
    }
    done.push(x);
  }
  return { ok: true, plan };
}

// Primer momento libre desde ahora (a minuto exacto, redondeado a 5 min) para uno o varios servicios seguidos.
// Sirve a "Llegó sin cita" / "Llamó y quiere turno": puede ser ahora mismo si Elena está libre, o cuando termine lo que tiene.
// Quien ya llegó y espera (checked_in) cuenta como ocupado desde ahora, para que nadie se le adelante.
export async function nextFreeStart(serviceIds, fromMs = Date.now()) {
  const ids = [...new Set(serviceIds)];
  const { data: found } = await db.from('services').select('*').in('id', ids).eq('is_active', true);
  const byId = Object.fromEntries((found || []).map((x) => [x.id, x]));
  const items = serviceIds.map((id) => byId[id]);
  if (!items.length || items.some((x) => !x)) return null;
  const total = items.reduce((n, x) => n + x.duration_min, 0);

  const { data: links } = await db.from('stylist_services').select('service_id,stylists!inner(id,is_bookable,sort_order)')
    .in('service_id', ids).eq('stylists.is_bookable', true);
  const per = {};
  (links || []).forEach((l) => { (per[l.stylists.id] ||= { st: l.stylists, n: new Set() }).n.add(l.service_id); });
  const stylists = Object.values(per).filter((x) => x.n.size === ids.length).map((x) => x.st).sort((a, b) => a.sort_order - b.sort_order);
  if (!stylists.length) return null;
  const { data: hrsAll } = await db.from('business_hours').select('*');
  const R = 300000; // 5 min
  const up = (ms) => Math.ceil(ms / R) * R;

  for (let i = 0; i < 14; i++) {
    const date = new Date(fromMs - 5 * 3600000 + i * 864e5).toISOString().slice(0, 10);
    const wd = new Date(`${date}T12:00:00${TZ}`).getUTCDay();
    const hrs = (hrsAll || []).find((h) => h.weekday === wd);
    if (!hrs?.is_open) continue;
    const openMs = +new Date(iso(date, toMin(hrs.open_time))), closeMs = +new Date(iso(date, toMin(hrs.close_time)));
    if (fromMs >= closeMs) continue;
    const dayStart = iso(date, 0), dayEnd = iso(date, 1439);
    const [{ data: appts }, { data: off }] = await Promise.all([
      db.from('appointments').select('stylist_id,starts_at,ends_at,started_at,checked_in_at,status').in('status', ['confirmed', 'pending'])
        .lt('starts_at', dayEnd).gt('ends_at', dayStart),
      db.from('stylist_time_off').select('stylist_id,starts_at,ends_at').lt('starts_at', dayEnd).gt('ends_at', dayStart),
    ]);
    const blocks = [...(appts || []).map((x) => {
      let a = +new Date(x.starts_at), b = +new Date(x.ends_at);
      // Atendiéndose o esperando y ya pasó su hora: sigue ocupando desde ahora hasta que termine
      if (i === 0 && x.status === 'confirmed' && (x.started_at || x.checked_in_at) && a < fromMs) { b = Math.max(b, fromMs + R); if (!x.started_at) { b = fromMs + (b - a); a = fromMs; } else a = Math.min(a, fromMs); }
      return { s: x.stylist_id, a, b };
    }), ...(off || []).map((x) => ({ s: x.stylist_id, a: +new Date(x.starts_at), b: +new Date(x.ends_at) }))];

    const lunch = lunchOf(hrs);
    const lunchMs = lunch ? [+new Date(iso(date, lunch[0])), +new Date(iso(date, lunch[1]))] : null;
    let best = null;
    for (const st of stylists) {
      let t = Math.max(openMs, i === 0 ? up(fromMs) : openMs);
      const mine = [...blocks.filter((x) => x.s === st.id), ...(lunchMs ? [{ s: st.id, a: lunchMs[0], b: lunchMs[1] }] : [])].sort((p, q) => p.a - q.a);
      for (let guard = 0; guard < 60; guard++) {
        const clash = mine.find((x) => x.a < t + total * 60000 && x.b > t);
        if (!clash) break;
        t = up(clash.b);
      }
      if (t + total * 60000 > closeMs) continue;
      if (!best || t < best.t) best = { t, st };
    }
    if (best) return { starts_at: new Date(best.t).toISOString(), stylist_id: best.st.id, minutes: Math.max(0, Math.round((best.t - fromMs) / 60000)), total, items };
  }
  return null;
}
