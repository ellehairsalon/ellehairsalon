import { db, getSlots } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';
const TZ = '-05:00';
const short = (n = '') => { const [a, b] = n.trim().split(/\s+/); return b ? `${a} ${b[0]}.` : a; }; // solo nombre e inicial

export async function GET(req) {
  const key = new URL(req.url).searchParams.get('key');
  const keyOk = process.env.SCREEN_KEY && key === process.env.SCREEN_KEY;
  if (!keyOk && !(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });

  const nowMs = Date.now();
  const date = new Date(nowMs - 5 * 3600000).toISOString().slice(0, 10);
  const { data } = await db.from('appointments')
    .select('starts_at,checked_in_at,started_at,services(name,duration_min),stylists(name),clients(full_name)')
    .eq('status', 'confirmed').gte('starts_at', `${date}T00:00:00${TZ}`).lte('starts_at', `${date}T23:59:59${TZ}`)
    .order('starts_at');
  const list = data || [];
  const row = (a) => ({ name: short(a.clients.full_name), service: a.services.name, stylist: a.stylists.name, starts_at: a.starts_at });

  const inService = list.filter((a) => a.started_at).map((a) => ({
    ...row(a), endsAt: new Date(+new Date(a.started_at) + a.services.duration_min * 60000).toISOString(),
  }));
  const waiting = list.filter((a) => a.checked_in_at && !a.started_at).map((a) => ({ ...row(a), since: a.checked_in_at }));
  const next = list.filter((a) => !a.checked_in_at && !a.started_at && +new Date(a.starts_at) >= nowMs - 10 * 60000)
    .slice(0, 4).map(row);

  // Próximo hueco libre para el servicio más corto (estimado según la agenda)
  const { data: sv } = await db.from('services').select('id').eq('is_active', true).order('duration_min').limit(1);
  let nextFreeAt = null;
  for (let i = 0; sv?.[0] && i < 2 && !nextFreeAt; i++) {
    const d = new Date(nowMs - 5 * 3600000 + i * 864e5).toISOString().slice(0, 10);
    const { slots } = await getSlots(d, sv[0].id, null, 0);
    if (slots.length) nextFreeAt = slots[0].starts_at;
  }
  return Response.json({ inService, waiting, next, nextFreeAt });
}
