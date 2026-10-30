import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import { getFollowups } from '@/lib/followups';
import { paySupported } from '@/lib/notify';
import Follow from './Follow';

export const dynamic = 'force-dynamic';
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default async function Seguimiento() {
  if (!(await isAdmin())) redirect('/admin/login');
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') || 'https'}://${h.get('x-forwarded-host') || h.get('host')}`;
  const f = await getFollowups();

  // Números del mes (hora de Ecuador)
  const now = Date.now() - 5 * 3600000;
  const d = new Date(now);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  const from = new Date(Date.UTC(y, m - 5, 1, 5)).toISOString(); // inicio de hace 6 meses, en hora de Ecuador
  const paid = await paySupported();
  const { data: rows } = await db.from('appointments').select('starts_at' + (paid ? ',paid_amount' : '')).eq('status', 'completed').gte('starts_at', from).limit(5000);
  const months = Array.from({ length: 6 }, (_, i) => { const t = new Date(Date.UTC(y, m - 5 + i, 1)); return { key: `${t.getUTCFullYear()}-${t.getUTCMonth()}`, label: MESES[t.getUTCMonth()], total: 0, n: 0 }; });
  (rows || []).forEach((r) => {
    const t = new Date(+new Date(r.starts_at) - 5 * 3600000);
    const mo = months.find((x) => x.key === `${t.getUTCFullYear()}-${t.getUTCMonth()}`);
    if (mo) { mo.n += 1; mo.total += +r.paid_amount || 0; }
  });
  const { data: inv } = await db.from('inventory_items').select('qty,min_qty').eq('is_active', true);
  const low = (inv || []).filter((i) => +i.qty <= 0 || (+i.min_qty > 0 && +i.qty <= +i.min_qty)).length;

  return <Follow data={f} origin={origin} months={months} paid={paid} low={low} />;
}
