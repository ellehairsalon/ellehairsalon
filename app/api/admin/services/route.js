import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const { data } = await db.from('services')
    .select('id,name,duration_min,price,is_active,sort_order,service_categories(name,sort_order)')
    .order('sort_order');
  const services = (data || []).sort((a, b) =>
    (a.service_categories?.sort_order ?? 0) - (b.service_categories?.sort_order ?? 0) || a.sort_order - b.sort_order);
  return Response.json({ services });
}

export async function POST(req) {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const { id, price, duration_min, is_active } = await req.json();
  const patch = {};
  if (price !== undefined && price !== '' && +price >= 0) patch.price = +price;
  if (duration_min !== undefined && +duration_min > 0) patch.duration_min = Math.round(+duration_min);
  if (typeof is_active === 'boolean') patch.is_active = is_active;
  if (!id || !Object.keys(patch).length) return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  const { error } = await db.from('services').update(patch).eq('id', id);
  return error ? Response.json({ error: 'No se pudo guardar' }, { status: 500 }) : Response.json({ ok: true });
}
