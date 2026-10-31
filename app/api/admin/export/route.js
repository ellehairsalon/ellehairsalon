import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

const ec = (iso) => (iso ? new Date(+new Date(iso) - 5 * 3600000).toISOString().slice(0, 16).replace('T', ' ') : '');
const safe = (v) => { // evita que Excel ejecute texto que empieza con = + - @
  if (typeof v !== 'string') return v ?? '';
  return /^[=+\-@\t\r]/.test(v) && !/^\+\d{8,15}$/.test(v) ? "'" + v : v;
};

const ESTADO = { pending: 'Pendiente', confirmed: 'Confirmada', cancelled: 'Cancelada', completed: 'Terminada', no_show: 'No vino' };

const SETS = {
  clientes: {
    name: 'Clientes',
    load: () => db.from('clients').select('*').order('full_name').limit(20000),
    cols: [['Nombre', 28, (r) => r.full_name], ['WhatsApp', 18, (r) => r.phone], ['Correo', 28, (r) => r.email], ['Cédula', 14, (r) => r.cedula],
      ['Cumpleaños', 12, (r) => (r.birthday_month ? `${r.birthday_day}/${r.birthday_month}` : '')], ['Notas', 40, (r) => r.internal_notes]],
  },
  citas: {
    name: 'Citas',
    load: () => db.from('appointments').select('*,services(name),clients(full_name,phone)').order('starts_at', { ascending: false }).limit(50000),
    cols: [['Fecha y hora', 18, (r) => ec(r.starts_at)], ['Cliente', 26, (r) => r.guest_name || r.clients?.full_name], ['WhatsApp', 18, (r) => r.clients?.phone],
      ['Servicio', 24, (r) => r.services?.name], ['Estado', 12, (r) => ESTADO[r.status] || r.status], ['Precio', 10, (r) => (r.price == null ? '' : +r.price)],
      ['Recargo prioritario', 12, (r) => (r.early_fee == null ? '' : +r.early_fee)], ['Cobrado', 10, (r) => (r.paid_amount == null ? '' : +r.paid_amount)],
      ['Forma de pago', 14, (r) => r.paid_method], ['Notas', 40, (r) => r.notes]],
  },
  inventario: {
    name: 'Inventario',
    load: () => db.from('inventory_items').select('*').order('name').limit(5000),
    cols: [['Producto', 30, (r) => r.name], ['Categoría', 16, (r) => r.category], ['Cantidad', 10, (r) => (r.qty == null ? '' : +r.qty)],
      ['Mínimo', 10, (r) => (r.min_qty == null ? '' : +r.min_qty)], ['Unidad', 12, (r) => r.unit], ['Nota', 40, (r) => r.note]],
  },
};

// Descarga de respaldo: un solo archivo de Excel con tres hojas (Clientes, Citas, Inventario).
export async function GET(req) {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Elle Hair Salon';
  for (const set of Object.values(SETS)) {
    const { data } = await set.load();
    const ws = wb.addWorksheet(set.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = set.cols.map(([header, width], i) => ({ header, key: `c${i}`, width }));
    ws.getRow(1).font = { bold: true };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: set.cols.length } };
    (Array.isArray(data) ? data : []).forEach((r) => ws.addRow(Object.fromEntries(set.cols.map(([, , f], i) => [`c${i}`, safe(f(r))]))));
  }
  const buf = await wb.xlsx.writeBuffer();
  const day = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  return new Response(buf, { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="elle-respaldo-${day}.xlsx"`, 'Cache-Control': 'no-store' } });
}
