import { db, getSlots } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

const normPhone = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '593' + d.slice(1);
  else if (d.length === 9 && d.startsWith('9')) d = '593' + d; // celular escrito sin el 0
  return d.length >= 11 && d.length <= 15 ? '+' + d : null;
};
const bad = (error, status) => Response.json({ error }, { status });
const ACTIVE = 'No se pudo guardar. Si la clienta ya tiene otra cita pendiente, usa "Llegó" o "Empezar" en esa cita, o márcala como terminada o cancélala primero.';

async function findClient(p, n) {
  let { data: client } = await db.from('clients').select('id').eq('phone', p).maybeSingle();
  if (!client) ({ data: client } = await db.from('clients').insert({ phone: p, full_name: n }).select('id').single());
  return client;
}

export async function POST(req) {
  if (!(await isAdmin())) return bad('No autorizado', 401);
  const { service_id, starts_at, name, phone, walk_in, start_now } = await req.json();
  const p = normPhone(phone), n = String(name || '').trim();
  if (!p || n.length < 2) return bad('Revisa el nombre y el WhatsApp.', 400);

  // Llegó sin cita y se atiende ya, aunque haya otra clienta en atención.
  if (start_now) {
    const { data: svc } = await db.from('services').select('*').eq('id', service_id).eq('is_active', true).single();
    if (!svc) return bad('Servicio no disponible.', 400);
    const now = new Date(); now.setSeconds(0, 0);
    const start = now.toISOString(), end = new Date(+now + svc.duration_min * 60000).toISOString();
    const { data: links } = await db.from('stylist_services').select('stylists!inner(id,is_bookable,sort_order)')
      .eq('service_id', service_id).eq('stylists.is_bookable', true);
    const cands = (links || []).map((l) => l.stylists).sort((a, b) => a.sort_order - b.sort_order);
    if (!cands.length) return bad('Ninguna estilista activa ofrece este servicio.', 400);

    let pick = cands[0], overlap = true; // prefiere una estilista libre; si no hay, se permite el traslape
    for (const c of cands) {
      const { count } = await db.from('appointments').select('id', { count: 'exact', head: true })
        .eq('stylist_id', c.id).eq('status', 'confirmed').lt('starts_at', end).gt('ends_at', start);
      if (!count) { pick = c; overlap = false; break; }
    }
    const client = await findClient(p, n);
    const { error } = await db.from('appointments').insert({
      client_id: client.id, stylist_id: pick.id, service_id, starts_at: start, ends_at: end, price: svc.price,
      early_fee: 0, source: 'walk_in', checked_in_at: start, started_at: start, overlap_ok: overlap,
    });
    if (error) return error.code === '23505' ? bad(ACTIVE, 409) : bad('No se pudo guardar.', 500);
    return Response.json({ ok: true });
  }

  const { slots, svc } = await getSlots(String(starts_at).slice(0, 10), service_id, null, 0);
  const slot = slots.find((s) => s.starts_at === starts_at);
  if (!slot) return bad('Ese horario ya no está libre.', 409);
  const client = await findClient(p, n);
  const ends_at = new Date(+new Date(starts_at) + svc.duration_min * 60000).toISOString();
  const { error } = await db.from('appointments').insert({
    client_id: client.id, stylist_id: slot.stylist_id, service_id, starts_at, ends_at,
    price: svc.price, early_fee: slot.fee, source: walk_in ? 'walk_in' : 'manual',
    checked_in_at: walk_in ? new Date().toISOString() : null,
  });
  if (error) return bad(ACTIVE, 409);
  return Response.json({ ok: true });
}
