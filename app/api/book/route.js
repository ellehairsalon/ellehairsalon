import { db, getSlots } from '@/lib/slots';
import { normPhone } from '@/lib/validate';

const err = (error, status) => Response.json({ error }, { status });

export async function POST(req) {
  const { service_id, starts_at, name, phone } = await req.json();
  const p = normPhone(phone), n = String(name || '').trim().slice(0, 100);
  if (!p || n.length < 2 || !/^\d{4}-\d{2}-\d{2}T/.test(starts_at || ''))
    return err('Revisa tu nombre y tu número de WhatsApp.', 400);

  // El horario se vuelve a validar en el servidor: nunca se confía en el navegador.
  const { slots, svc } = await getSlots(starts_at.slice(0, 10), service_id);
  const slot = slots.find((s) => s.starts_at === starts_at);
  if (!slot) return err('Ese horario ya no está disponible. Elige otro.', 409);

  let { data: client } = await db.from('clients').select('*').eq('phone', p).maybeSingle();
  if (!client) ({ data: client } = await db.from('clients').insert({ phone: p, full_name: n }).select().single());

  const { data: active } = await db.from('appointments').select('id')
    .eq('client_id', client.id).eq('status', 'confirmed').maybeSingle();
  if (active) return err('Ya tienes una cita agendada. Para cambiarla o cancelarla usa el enlace de tu confirmación o escríbenos por WhatsApp.', 409);

  const ends_at = new Date(+new Date(starts_at) + svc.duration_min * 60000).toISOString();
  const { data: appt, error } = await db.from('appointments')
    .insert({ client_id: client.id, stylist_id: slot.stylist_id, service_id, starts_at, ends_at, price: svc.price, early_fee: slot.fee })
    .select('manage_token').single();
  if (error) return err('Ese horario acaba de ocuparse. Elige otro.', 409);
  return Response.json({ token: appt.manage_token });
}
