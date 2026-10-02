import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

const bad = (error, status) => Response.json({ error }, { status });

export async function GET() {
  if (!(await isAdmin())) return bad('No autorizado', 401);
  const { data } = await db.from('stylist_time_off').select('starts_at,ends_at,reason')
    .gte('ends_at', new Date().toISOString()).order('starts_at');
  const seen = new Set();
  const closures = (data || []).filter((c) => { const k = c.starts_at + c.ends_at; return seen.has(k) ? false : seen.add(k); });
  return Response.json({ closures });
}

// Cierra el horario para todas las estilistas que los clientes pueden elegir.
export async function POST(req) {
  if (!(await isAdmin())) return bad('No autorizado', 401);
  const { action, starts_at, ends_at, reason } = await req.json();

  if (action === 'remove') {
    await db.from('stylist_time_off').delete().eq('starts_at', starts_at).eq('ends_at', ends_at);
    return Response.json({ ok: true });
  }
  if (!(+new Date(ends_at) > +new Date(starts_at))) return bad('La hora de fin debe ser después del inicio.', 400);
  const { data: st } = await db.from('stylists').select('id').eq('is_bookable', true);
  if (!st?.length) return bad('No hay estilistas activas.', 400);
  const { error } = await db.from('stylist_time_off')
    .insert(st.map((s) => ({ stylist_id: s.id, starts_at, ends_at, reason: String(reason || '').slice(0, 100) || null })));
  if (error) return bad('No se pudo guardar.', 500);
  const { count } = await db.from('appointments').select('id', { count: 'exact', head: true })
    .eq('status', 'confirmed').lt('starts_at', ends_at).gt('ends_at', starts_at);
  return Response.json({ ok: true, conflicts: count || 0 });
}
