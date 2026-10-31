import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const cell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita que Excel ejecute fórmulas
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (cols, rows) => '﻿' + [cols.map((c) => c[1]).join(','), ...rows.map((r) => cols.map((c) => cell(c[2] ? c[2](r) : r[c[0]])).join(','))].join('\r\n');
const ec = (iso) => (iso ? new Date(+new Date(iso) - 5 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : '');

// Descarga de respaldo: /api/admin/export?tipo=clientes | citas | inventario
export async function GET(req) {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const tipo = new URL(req.url).searchParams.get('tipo');
  let body, name;
  if (tipo === 'clientes') {
    const { data } = await db.from('clients').select('*').order('full_name').limit(20000);
    body = csv([['full_name', 'Nombre'], ['phone', 'WhatsApp'], ['email', 'Correo'], ['cedula', 'Cédula'],
      ['b', 'Cumpleaños', (r) => (r.birthday_month ? `${r.birthday_day}/${r.birthday_month}` : '')], ['internal_notes', 'Notas']], data || []);
    name = 'clientes';
  } else if (tipo === 'citas') {
    const { data } = await db.from('appointments').select('*,services(name),clients(full_name,phone)').order('starts_at', { ascending: false }).limit(50000);
    body = csv([['d', 'Fecha y hora', (r) => ec(r.starts_at)], ['c', 'Cliente', (r) => r.guest_name || r.clients?.full_name], ['p', 'WhatsApp', (r) => r.clients?.phone],
      ['s', 'Servicio', (r) => r.services?.name], ['status', 'Estado'], ['price', 'Precio'], ['early_fee', 'Recargo prioritario'],
      ['paid_amount', 'Cobrado'], ['paid_method', 'Forma de pago'], ['notes', 'Notas']], data || []);
    name = 'citas';
  } else if (tipo === 'inventario') {
    const { data } = await db.from('inventory_items').select('*').order('name').limit(5000);
    body = csv([['name', 'Producto'], ['category', 'Categoría'], ['qty', 'Cantidad'], ['min_qty', 'Mínimo'], ['unit', 'Unidad'], ['note', 'Nota']], data || []);
    name = 'inventario';
  } else return Response.json({ error: 'Tipo inválido' }, { status: 400 });
  const day = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="elle-${name}-${day}.csv"`, 'Cache-Control': 'no-store' } });
}
