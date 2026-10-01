import { createClient } from '@supabase/supabase-js';

export const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TZ = '-05:00'; // Ecuador continental, sin horario de verano
const toMin = (t) => { const [h, m] = t.split(':'); return +h * 60 + +m; };
const iso = (date, min) =>
  `${date}T${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00${TZ}`;

// Horarios libres de un día para un servicio. Devuelve la estilista asignada a cada uno.
export async function getSlots(date, serviceId) {
  const weekday = new Date(`${date}T12:00:00${TZ}`).getUTCDay();
  const [{ data: cfg }, { data: hrs }, { data: svc }] = await Promise.all([
    db.from('salon_settings').select('*').eq('id', 1).single(),
    db.from('business_hours').select('*').eq('weekday', weekday).single(),
    db.from('services').select('*').eq('id', serviceId).eq('is_active', true).single(),
  ]);
  if (!cfg || !hrs?.is_open || !svc) return { slots: [], svc };

  const { data: links } = await db
    .from('stylist_services')
    .select('stylists!inner(id,is_bookable,sort_order)')
    .eq('service_id', serviceId)
    .eq('stylists.is_bookable', true);
  const stylists = (links || []).map((l) => l.stylists).sort((a, b) => a.sort_order - b.sort_order);

  const dayStart = iso(date, 0), dayEnd = iso(date, 1439);
  const [{ data: appts }, { data: off }] = await Promise.all([
    db.from('appointments').select('stylist_id,starts_at,ends_at').eq('status', 'confirmed')
      .gte('starts_at', dayStart).lte('starts_at', dayEnd),
    db.from('stylist_time_off').select('stylist_id,starts_at,ends_at')
      .lt('starts_at', dayEnd).gt('ends_at', dayStart),
  ]);
  const busy = [...(appts || []), ...(off || [])].map((x) => ({
    s: x.stylist_id, a: +new Date(x.starts_at), b: +new Date(x.ends_at),
  }));

  const open = toMin(hrs.open_time), close = toMin(hrs.close_time);
  const from = hrs.early_open_time ? toMin(hrs.early_open_time) : open;
  const fee = cfg.early_fee_type === 'percent'
    ? +(svc.price * cfg.early_fee_value / 100).toFixed(2)
    : +cfg.early_fee_value;

  const slots = [];
  for (let m = from; m + svc.duration_min <= close; m += cfg.slot_minutes) {
    const a = +new Date(iso(date, m)), b = a + svc.duration_min * 60000;
    if (a < Date.now() + 3600000) continue; // mínimo 1 hora de anticipación
    const free = stylists.find((st) => !busy.some((x) => x.s === st.id && x.a < b && x.b > a));
    if (free) slots.push({
      time: iso(date, m).slice(11, 16), starts_at: iso(date, m),
      stylist_id: free.id, early: m < open, fee: m < open ? fee : 0,
    });
  }
  return { slots, svc };
}
