import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import TabBar from './TabBar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  let pending = 0, lowStock = 0;
  if (await isAdmin()) { // solicitudes por confirmar: es el número rojo de la barra
    const { count } = await db.from('appointments').select('id', { count: 'exact', head: true })
      .eq('status', 'pending').is('change_starts_at', null).gte('starts_at', new Date().toISOString());
    const { count: changes } = await db.from('appointments').select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed').not('change_starts_at', 'is', null).gte('starts_at', new Date().toISOString());
    const { count: toNotify } = await db.from('appointments').select('id', { count: 'exact', head: true }).not('notify_kind', 'is', null); // error si falta migration-14: cuenta 0
    pending = (count || 0) + (changes || 0) + (toNotify || 0);
    const { data: inv } = await db.from('inventory_items').select('qty,min_qty').eq('is_active', true); // si la tabla aún no existe, simplemente no hay aviso
    lowStock = (inv || []).filter((i) => +i.qty <= 0 || (+i.min_qty > 0 && +i.qty <= +i.min_qty)).length;
  }
  return (<>{children}<TabBar pending={pending} lowStock={lowStock} /></>);
}
