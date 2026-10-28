import { redirect } from 'next/navigation';
import { db, isEarlyAt } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import Inbox from './Inbox';

export const dynamic = 'force-dynamic';

export default async function Pendientes() {
  if (!(await isAdmin())) redirect('/admin/login');
  const SEL = 'id,client_id,starts_at,ends_at,price,early_fee,client_note,created_at,group_id,guest_name,manage_token,change_starts_at,change_ends_at,services(name,duration_min,service_categories(name)),stylists(name),clients(full_name,phone,email)';
  const nowIso = new Date().toISOString();
  const [{ data }, { data: chg }] = await Promise.all([
    db.from('appointments').select(SEL).eq('status', 'pending').gte('starts_at', nowIso).order('starts_at'),
    db.from('appointments').select(SEL).eq('status', 'confirmed').not('change_starts_at', 'is', null).gte('starts_at', nowIso).order('starts_at'),
  ]);
  const build = async (list, kind) => {
    const byKey = {};
    (list || []).forEach((r) => { (byKey[r.group_id || r.id] ||= []).push(r); });
    return Promise.all(Object.values(byKey).map(async (rows) => {
      rows.sort((x, y) => +new Date(x.starts_at) - +new Date(y.starts_at));
      const main = rows.find((r) => !r.guest_name) || rows[0];
      const alt = kind !== 'new';
      const when = alt ? rows[0].change_starts_at : rows[0].starts_at;
      return { ...main, kind, starts_at: rows[0].starts_at, new_starts_at: alt ? rows[0].change_starts_at : null,
        early: await isEarlyAt(when), early_fee: rows.reduce((n, r) => n + +r.early_fee, 0), people: rows };
    }));
  };
  const groups = [...(await build((data || []).filter((r) => !r.change_starts_at), 'new')), ...(await build((data || []).filter((r) => r.change_starts_at), 'proposal')), ...(await build(chg, 'change'))]
    .sort((x, y) => +new Date(x.starts_at) - +new Date(y.starts_at));
  const { data: cfg } = await db.from('salon_settings').select('reschedule_min_hours,early_bonus,early_fee_type,early_fee_value').eq('id', 1).single();
  return (
    <main className="wide">
      <h1>Por confirmar</h1>
      <p className="sub-note">Cada solicitud ya aparta su horario en la agenda hasta que la respondas.</p>
      <Inbox items={groups} hours={cfg?.reschedule_min_hours ?? 10} bonus={cfg?.early_bonus} feeType={cfg?.early_fee_type} feeValue={cfg?.early_fee_value} />
    </main>
  );
}
