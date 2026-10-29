import { redirect } from 'next/navigation';
import { db } from '@/lib/slots';
import { isAdmin } from '@/lib/admin';
import Inventory from './Inventory';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await isAdmin())) redirect('/admin/login');
  const { data } = await db.from('inventory_items')
    .select('id,name,category,qty,min_qty,unit,note,updated_at').eq('is_active', true).order('name');
  return (
    <main className="wide">
      <Inventory initial={data || []} />
    </main>
  );
}
