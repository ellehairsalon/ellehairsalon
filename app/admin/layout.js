import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import TabBar from './TabBar';
import NewAppt from './NewAppt';
import { getFollowups } from '@/lib/followups';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  let pending = 0, lowStock = 0, follow = 0, policy = 10, bonus;
  if (await isAdmin()) { // solicitudes por confirmar: es el número rojo de la barra
    const { count } = await db.from('appointments').select('id', { count: 'exact', head: true })
      .eq('status', 'pending').is('change_starts_at', null).gte('starts_at', new Date().toISOString());
    const { count: changes } = await db.from('appointments').select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed').not('change_starts_at', 'is', null).gte('starts_at', new Date().toISOString());
    const { count: toNotify } = await db.from('appointments').select('id', { count: 'exact', head: true }).not('notify_kind', 'is', null); // error si falta migration-14: cuenta 0
    const { data: cfg } = await db.from('salon_settings').select('reschedule_min_hours,early_bonus').eq('id', 1).single();
    policy = cfg?.reschedule_min_hours ?? 10; bonus = cfg?.early_bonus;
    pending = (count || 0) + (changes || 0) + (toNotify || 0);
    const { data: inv } = await db.from('inventory_items').select('qty,min_qty').eq('is_active', true); // si la tabla aún no existe, simplemente no hay aviso
    lowStock = (inv || []).filter((i) => +i.qty <= 0 || (+i.min_qty > 0 && +i.qty <= +i.min_qty)).length;
    try { follow = (await getFollowups()).count; } catch { /* el seguimiento nunca debe romper el panel */ }
  }
  return (<>{children}{await isAdmin() && <NewAppt policyHours={policy} bonus={bonus} />}<TabBar pending={pending} lowStock={lowStock} follow={follow} /></>);
}
