import { db, getSlots } from '@/lib/slots';

// Ecuador: 09XXXXXXXX -> +5939XXXXXXXX. Otros países: con código, ej. +1...
const normPhone = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '593' + d.slice(1);
  return d.length >= 11 && d.length <= 15 ? '+' + d : null;
};
const err = (error, status) => Response.json({ error }, { status });

export async function POST(req) {
  const { service_id, starts_at, name, phone, birthday_month, birthday_day } = await req.json();
  const p = normPhone(phone), n = String(name || '').trim();
  if (!p || n.length < 2 || !/^\d{4}-\d{2}-\d{2}T/.test(starts_at || ''))
    return err('Revisa tu nombre y tu número de WhatsApp.', 400);

  // El horario se vuelve a validar en el servidor: nunca se confía en el navegador.
  const { slots, svc } = await getSlots(starts_at.slice(0, 10), service_id);
  const slot = slots.find((s) => s.starts_at === starts_at);
  if (!slot) return err('Ese horario ya no está disponible. Elige otro.', 409);

  let { data: client } = await db.from('clients').select('*').eq('phone', p).maybeSingle();
  if (!client) ({ data: client } = await db.from('clients').insert({ phone: p, full_name: n }).select().single());

  const bm = +birthday_month, bd = +birthday_day;
  if (bm >= 1 && bm <= 12 && bd >= 1 && bd <= 31 && !client.birthday_month)
    await db.from('clients').update({ birthday_month: bm, birthday_day: bd }).eq('id', client.id);

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
