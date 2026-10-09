import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const { data } = await db.from('services')
    .select('id,name,duration_min,price,is_active,sort_order,category_id,service_categories(name,sort_order)')
    .order('sort_order');
  const services = (data || []).sort((a, b) =>
    (a.service_categories?.sort_order ?? 0) - (b.service_categories?.sort_order ?? 0) || a.sort_order - b.sort_order);
  return Response.json({ services });
}

export async function POST(req) {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const body = await req.json();
  const { id, price, duration_min, is_active } = body;
  if (body.create) { // servicio nuevo dentro de una categoría; lo hacen todas las estilistas que se pueden elegir
    const name = String(body.name || '').trim().slice(0, 80);
    if (name.length < 2 || !body.category_id || !(+body.price >= 0) || !(+body.duration_min > 0))
      return Response.json({ error: 'Escribe nombre, precio y minutos.' }, { status: 400 });
    const { data: svc, error } = await db.from('services').insert({
      category_id: body.category_id, name, price: +body.price, duration_min: Math.round(+body.duration_min), sort_order: 99,
    }).select('id').single();
    if (error) return Response.json({ error: 'No se pudo guardar' }, { status: 500 });
    const { data: st } = await db.from('stylists').select('id').eq('is_bookable', true);
    if (st?.length) await db.from('stylist_services').insert(st.map((s) => ({ stylist_id: s.id, service_id: svc.id })));
    return Response.json({ ok: true });
  }
  const patch = {};
  if (typeof body.name === 'string' && body.name.trim().length >= 2) patch.name = body.name.trim().slice(0, 80);
  if (price !== undefined && price !== '' && +price >= 0) patch.price = +price;
  if (duration_min !== undefined && +duration_min > 0) patch.duration_min = Math.round(+duration_min);
  if (typeof is_active === 'boolean') patch.is_active = is_active;
  if (!id || !Object.keys(patch).length) return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  const { error } = await db.from('services').update(patch).eq('id', id);
  return error ? Response.json({ error: 'No se pudo guardar' }, { status: 500 }) : Response.json({ ok: true });
}
