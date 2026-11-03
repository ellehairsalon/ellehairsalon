import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

import { CATEGORIES, BRANDS, SIZE_UNITS } from '@/lib/inventory';
const bad = (error, status = 400) => Response.json({ error }, { status });
const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(+v) ? null : Math.round(+v * 100) / 100);
const COLS = 'id,name,category,brand,code,size_amt,size_unit,qty,min_qty,unit,note,updated_at';
const txt = (v, n) => String(v ?? '').trim().slice(0, n) || null;
const brandOk = (v) => (BRANDS.includes(v) ? v : null);
const sizeUnitOk = (v) => (SIZE_UNITS.includes(v) ? v : null);

export async function GET() {
  if (!(await isAdmin())) return bad('No autorizado', 401);
  const { data } = await db.from('inventory_items').select(COLS).eq('is_active', true).order('name');
  return Response.json({ items: data || [] });
}

export async function POST(req) {
  if (!(await isAdmin())) return bad('No autorizado', 401);
  const b = await req.json();
  const now = new Date().toISOString();

  if (b.action === 'create') {
    const code = txt(b.code, 30);
    const name = String(b.name || '').trim().slice(0, 80) || (b.category === 'Tintes' && code ? `Tinte ${code}` : '');
    if (name.length < 2) return bad('Escribe el nombre del producto.');
    const qty = num(b.qty) ?? 0, min = num(b.min_qty) ?? 1;
    if (qty < 0 || min < 0) return bad('Las cantidades no pueden ser negativas.');
    const { data, error } = await db.from('inventory_items').insert({
      name, category: CATEGORIES.includes(b.category) ? b.category : 'Otros', qty, min_qty: min,
      brand: brandOk(b.brand), code, size_amt: num(b.size_amt), size_unit: num(b.size_amt) ? sizeUnitOk(b.size_unit) : null,
      unit: String(b.unit || 'unidades').trim().slice(0, 20) || 'unidades', note: String(b.note || '').trim().slice(0, 200) || null,
    }).select(COLS).single();
    return error ? bad('No se pudo guardar.', 500) : Response.json({ ok: true, item: data });
  }

  if (!b.id) return bad('Datos inválidos');

  if (b.action === 'set') { // cantidad exacta (los botones + y − envían el nuevo total)
    const qty = num(b.qty);
    if (qty === null || qty < 0) return bad('Cantidad inválida.');
    const { error } = await db.from('inventory_items').update({ qty, updated_at: now }).eq('id', b.id);
    return error ? bad('No se pudo guardar.', 500) : Response.json({ ok: true });
  }

  if (b.action === 'update') {
    const patch = { updated_at: now };
    if (typeof b.name === 'string') { const n = b.name.trim().slice(0, 80); if (n.length < 2) return bad('Escribe el nombre del producto.'); patch.name = n; }
    if (CATEGORIES.includes(b.category)) patch.category = b.category;
    if (b.min_qty !== undefined) { const m = num(b.min_qty); if (m === null || m < 0) return bad('Mínimo inválido.'); patch.min_qty = m; }
    if (b.qty !== undefined) { const q = num(b.qty); if (q === null || q < 0) return bad('Cantidad inválida.'); patch.qty = q; }
    if (b.brand !== undefined) patch.brand = brandOk(b.brand);
    if (b.code !== undefined) patch.code = txt(b.code, 30);
    if (b.size_amt !== undefined) { const a = num(b.size_amt); patch.size_amt = a && a > 0 ? a : null; patch.size_unit = patch.size_amt ? sizeUnitOk(b.size_unit) : null; }
    if (typeof b.unit === 'string') patch.unit = b.unit.trim().slice(0, 20) || 'unidades';
    if (typeof b.note === 'string') patch.note = b.note.trim().slice(0, 200) || null;
    const { error } = await db.from('inventory_items').update(patch).eq('id', b.id);
    return error ? bad('No se pudo guardar.', 500) : Response.json({ ok: true });
  }

  if (b.action === 'delete') { // se oculta (no se borra) por si fue un error
    const { error } = await db.from('inventory_items').update({ is_active: false, updated_at: now }).eq('id', b.id);
    return error ? bad('No se pudo borrar.', 500) : Response.json({ ok: true });
  }
  if (b.action === 'restore') {
    const { error } = await db.from('inventory_items').update({ is_active: true, updated_at: now }).eq('id', b.id);
    return error ? bad('No se pudo restaurar.', 500) : Response.json({ ok: true });
  }
  return bad('Acción inválida');
}
