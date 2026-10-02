import { db, getSlots } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

const normPhone = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '593' + d.slice(1);
  return d.length >= 11 && d.length <= 15 ? '+' + d : null;
};
const bad = (error, status) => Response.json({ error }, { status });

export async function POST(req) {
  if (!(await isAdmin())) return bad('No autorizado', 401);
  const { service_id, starts_at, name, phone, walk_in } = await req.json();
  const p = normPhone(phone), n = String(name || '').trim();
  if (!p || n.length < 2) return bad('Revisa el nombre y el WhatsApp.', 400);

  const { slots, svc } = await getSlots(String(starts_at).slice(0, 10), service_id, null, 0);
  const slot = slots.find((s) => s.starts_at === starts_at);
  if (!slot) return bad('Ese horario ya no está libre.', 409);

  let { data: client } = await db.from('clients').select('id').eq('phone', p).maybeSingle();
  if (!client) ({ data: client } = await db.from('clients').insert({ phone: p, full_name: n }).select('id').single());

  const ends_at = new Date(+new Date(starts_at) + svc.duration_min * 60000).toISOString();
  const { error } = await db.from('appointments').insert({
    client_id: client.id, stylist_id: slot.stylist_id, service_id, starts_at, ends_at,
    price: svc.price, early_fee: slot.fee, source: walk_in ? 'walk_in' : 'manual',
    checked_in_at: walk_in ? new Date().toISOString() : null,
  });
  if (error) return bad('No se pudo guardar. Si la clienta ya tiene otra cita pendiente, márcala como terminada o cancélala primero.', 409);
  return Response.json({ ok: true });
}
