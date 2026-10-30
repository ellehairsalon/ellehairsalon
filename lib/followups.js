import { db } from '@/lib/slots';
import { followSupported, followActionsSupported } from '@/lib/notify';

const ecDate = (ms) => new Date(ms - 5 * 3600000).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((+new Date(a + 'T12:00:00Z') - +new Date(b + 'T12:00:00Z')) / 864e5); // a - b en días

// Clientes a los que les toca volver (o les falta poco), según el "volver cada N semanas" de cada servicio.
// days > 0: atrasado; days <= 0: faltan -days días.
export async function getFollowups() {
  if (!(await followSupported())) return { supported: false, items: [], count: 0 };
  const now = Date.now();
  const [{ data: done }, { data: future }, actions] = await Promise.all([
    db.from('appointments')
      .select('id,client_id,starts_at,service_id,services(name,return_weeks,service_categories(name)),clients(full_name,phone)')
      .eq('status', 'completed').gte('starts_at', new Date(now - 420 * 864e5).toISOString())
      .order('starts_at', { ascending: false }).limit(3000),
    db.from('appointments').select('client_id').in('status', ['pending', 'confirmed']).gte('starts_at', new Date(now).toISOString()),
    (await followActionsSupported()) ? db.from('followup_actions').select('client_id,appt_id,action,at') : Promise.resolve({ data: [] }),
  ]);
  const booked = new Set((future || []).map((r) => r.client_id));
  const act = {};
  (actions.data || []).forEach((a) => { act[`${a.client_id}:${a.appt_id}`] = a; });
  const today = ecDate(now);

  const per = {}; // cliente -> { servicio -> última cita terminada }
  for (const a of done || []) {
    const w = a.services?.return_weeks;
    if (!w || !a.clients) continue;
    const m = (per[a.client_id] ||= {});
    if (m[a.service_id]) continue; // vienen ordenadas: la primera es la más reciente
    m[a.service_id] = { appt_id: a.id, last: a.starts_at, name: a.services.name, cat: a.services.service_categories?.name, weeks: w, client: a.clients, due: ecDate(+new Date(a.starts_at) + w * 7 * 864e5) };
  }

  const items = [];
  for (const [client_id, svcs] of Object.entries(per)) {
    if (booked.has(client_id)) continue; // ya tiene una cita próxima
    const list = Object.values(svcs).sort((x, y) => (x.due < y.due ? -1 : 1));
    const main = list[0];
    const days = dayDiff(today, main.due);
    if (days < -7 || days > 180) continue; // solo los de esta semana o atrasados (hasta ~6 meses)
    const a = act[`${client_id}:${main.appt_id}`];
    if (a?.action === 'dismissed') continue;
    items.push({
      client_id, appt_id: main.appt_id, name: main.client.full_name, phone: main.client.phone,
      service: main.name, cat: main.cat, others: list.slice(1).map((x) => x.name), last: main.last, due: main.due, days, weeks: main.weeks,
      contacted: a?.action === 'contacted' ? a.at : null,
    });
  }
  items.sort((x, y) => y.days - x.days);
  return { supported: true, items, count: items.filter((i) => !i.contacted && i.days >= 0).length };
}
