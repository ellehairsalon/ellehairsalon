import { randomUUID } from 'crypto';
import { db, getGroupSlots, earlyFeeFor, nextFreeStart } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import { normPhone } from '@/lib/validate';

const bad = (error, status) => Response.json({ error }, { status });
const ACTIVE = 'No se pudo guardar. Si el cliente ya tiene otra cita pendiente, usa "Llegó" o "Empezar" en esa cita, o márcala como terminada o cancélala primero.';
const MAX_SERVICES = 6;

async function findClient(p, n) {
  let { data: client } = await db.from('clients').select('id').eq('phone', p).maybeSingle();
  if (!client) ({ data: client } = await db.from('clients').insert({ phone: p, full_name: n }).select('id').single());
  else await db.from('clients').update({ full_name: n.slice(0, 100) }).eq('id', client.id).neq('full_name', n); // Elena corrigió el nombre
  return client;
}

// Estilistas activas que hacen TODOS los servicios, en orden. Se prefiere una libre en ese rato; si no hay, se permite el traslape.
async function pickStylist(ids, startIso, endIso) {
  const { data: links } = await db.from('stylist_services').select('service_id,stylists!inner(id,is_bookable,sort_order)')
    .in('service_id', ids).eq('stylists.is_bookable', true);
  const per = {};
  (links || []).forEach((l) => { (per[l.stylists.id] ||= { st: l.stylists, n: new Set() }).n.add(l.service_id); });
  const cands = Object.values(per).filter((x) => x.n.size === ids.length).map((x) => x.st).sort((a, b) => a.sort_order - b.sort_order);
  if (!cands.length) return null;
  for (const c of cands) {
    const { count } = await db.from('appointments').select('id', { count: 'exact', head: true })
      .eq('stylist_id', c.id).in('status', ['confirmed', 'pending']).lt('starts_at', endIso).gt('ends_at', startIso);
    if (!count) return { id: c.id, overlap: false };
  }
  return { id: cands[0].id, overlap: true };
}

export async function POST(req) {
  if (!(await isAdmin())) return bad('No autorizado', 401);
  const body = await req.json();
  const { starts_at, name, phone, force } = body;
  const next = !!body.next, present = !!body.present; // next: primer hueco libre real; present: el cliente ya está en el salón
  const notes = String(body.notes || '').trim().slice(0, 500) || null;
  const p = normPhone(phone), n = String(name || '').trim().slice(0, 100);
  if (!p || n.length < 2) return bad('Revisa el nombre y el WhatsApp.', 400);

  const ids = (Array.isArray(body.items) && body.items.length ? body.items : [body.service_id]).slice(0, MAX_SERVICES);
  if (!ids.length || ids.some((x) => !x)) return bad('Elige al menos un servicio.', 400);
  const { data: found } = await db.from('services').select('*').in('id', [...new Set(ids)]).eq('is_active', true);
  const byId = Object.fromEntries((found || []).map((x) => [x.id, x]));
  const svcs = ids.map((id) => byId[id]);
  if (svcs.some((x) => !x)) return bad('Un servicio ya no está disponible.', 400);
  const total = svcs.reduce((s, x) => s + x.duration_min, 0);

  // Hora de inicio y estilista
  let start, stylist_id, overlap = false;
  if (next) { // primer hueco libre (puede ser ahora mismo): el sistema decide, Elena solo confirma
    const nf = await nextFreeStart(ids);
    if (!nf) return bad('No hay hueco libre en los próximos días para estos servicios.', 409);
    start = nf.starts_at; stylist_id = nf.stylist_id;
  } else {
    if (!/^\d{4}-\d{2}-\d{2}T/.test(starts_at || '')) return bad('Elige día y hora.', 400);
    start = new Date(starts_at).toISOString();
    const { slots } = await getGroupSlots(String(starts_at).slice(0, 10), ids, [], 0);
    const slot = slots.find((s) => +new Date(s.starts_at) === +new Date(starts_at));
    if (slot) stylist_id = slot.stylist_id;
    else if (force) { // Elena decide agendar fuera de los horarios libres (con aviso previo en pantalla)
      const pick = await pickStylist([...new Set(ids)], start, new Date(+new Date(start) + total * 60000).toISOString());
      if (!pick) return bad('Ninguna estilista activa ofrece estos servicios.', 400);
      ({ id: stylist_id, overlap } = pick);
    } else return bad('Ese horario ya no está libre.', 409);
  }

  const client = await findClient(p, n);
  // Varios servicios = una cita por servicio, una tras otra. Desde el segundo llevan el nombre del cliente en "guest_name"
  // para que cuenten como la misma persona (la regla es una cita activa por cliente).
  const group_id = ids.length > 1 ? randomUUID() : null;
  let cursor = +new Date(start);
  const rows = [];
  for (let i = 0; i < svcs.length; i++) {
    const sv = svcs[i];
    const s = new Date(cursor).toISOString(), e = new Date(cursor + sv.duration_min * 60000).toISOString();
    rows.push({
      client_id: client.id, stylist_id, service_id: sv.id, starts_at: s, ends_at: e, price: sv.price,
      early_fee: await earlyFeeFor(s, +sv.price), source: next ? 'walk_in' : 'manual', notes: i === 0 ? notes : null,
      group_id, guest_name: i === 0 ? null : n, overlap_ok: overlap,
      ...(present && i === 0 ? { checked_in_at: new Date().toISOString() } : {}), // ya llegó: queda "En espera" hasta que Elena toque Empezar
    });
    cursor += sv.duration_min * 60000;
  }
  const { data: made, error } = await db.from('appointments').insert(rows).select('manage_token,starts_at').order('starts_at');
  if (error) return bad(error.code === '23505' || /duplicate|unique/i.test(error.message || '') ? ACTIVE : 'No se pudo guardar. Revisa que la hora esté libre.', 409);

  const early_fee = rows.reduce((s, r) => s + +r.early_fee, 0);
  return Response.json({ ok: true, appt: {
    manage_token: made?.[0]?.manage_token, starts_at: rows[0].starts_at, early: early_fee > 0, early_fee,
    service: svcs.map((x) => x.name).join(' + '), client_name: n, phone: p, minutes: Math.max(0, Math.round((+new Date(start) - Date.now()) / 60000)), present,
    items: rows.map((r, i) => ({ service: svcs[i].name, starts_at: r.starts_at })),
  } });
}
