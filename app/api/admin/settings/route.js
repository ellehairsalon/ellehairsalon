import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';

const bad = () => Response.json({ error: 'Datos inválidos' }, { status: 400 });
const T = /^\d{2}:\d{2}$/;

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const [{ data: cfg }, { data: hours }] = await Promise.all([
    db.from('salon_settings').select('*').eq('id', 1).single(),
    db.from('business_hours').select('*').order('weekday'),
  ]);
  return Response.json({ cfg, hours });
}

export async function POST(req) {
  if (!(await isAdmin())) return Response.json({ error: 'No autorizado' }, { status: 401 });
  const b = await req.json();
  let q;
  if (b.kind === 'fee') {
    if (!['fixed', 'percent'].includes(b.early_fee_type) || !(+b.early_fee_value >= 0)) return bad();
    q = db.from('salon_settings').update({ early_fee_type: b.early_fee_type, early_fee_value: +b.early_fee_value }).eq('id', 1);
  } else if (b.kind === 'hours') {
    if (!(b.weekday >= 0 && b.weekday <= 6) || !T.test(b.open_time) || !T.test(b.close_time) || (b.early_open_time && !T.test(b.early_open_time))) return bad();
    q = db.from('business_hours').update({
      is_open: !!b.is_open, open_time: b.open_time, close_time: b.close_time, early_open_time: b.early_open_time || null,
    }).eq('weekday', b.weekday);
  } else return bad();
  const { error } = await q;
  return error ? Response.json({ error: 'No se pudo guardar' }, { status: 500 }) : Response.json({ ok: true });
}
