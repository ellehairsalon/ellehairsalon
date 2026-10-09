import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import TabBar from './TabBar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  let pending = 0;
  if (await isAdmin()) { // solicitudes por confirmar: es el número rojo de la barra
    const { count } = await db.from('appointments').select('id', { count: 'exact', head: true })
      .eq('status', 'pending').gte('starts_at', new Date().toISOString());
    pending = count || 0;
  }
  return (<>{children}<TabBar pending={pending} /></>);
}
